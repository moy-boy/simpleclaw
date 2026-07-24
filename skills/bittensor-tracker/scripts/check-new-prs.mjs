#!/usr/bin/env node
// Monitor 1 (detection half): find NEW maintainer-team PRs across tracked subnet repos.
// The LLM review + posting is done by the cron agent (see SKILL.md); this script only
// does the deterministic detection, maintainer filtering, routing target, and state.
//
//   node check-new-prs.mjs   # print JSON array of new maintainer PRs to review
//
// Each item: { netuid, repo, number, title, author, url, channelId, route }
//   route = "subnet" (channelId is the subnet channel) or "general" (no subnet channel)
//
// First run per repo seeds lastSeenPr to the current max PR number (reviews nothing),
// so we never dump every already-open PR on startup.

import { acquireLock, channelIdByName, env, gh, log, readState, writeState } from "./lib.mjs";

if (!acquireLock("pr-monitor")) {
  log("pr-monitor already running; skipping this run");
  process.exit(0);
}

const STATE = "pr-state.json";
const LIMIT = env("BT_PR_LIST_LIMIT", "100");

const discovery = readState("discovery-cache.json", { map: {} }).map ?? {};
const prState = readState(STATE, {}); // { "<repo>": lastSeenPr }
const generalId = await channelIdByName(env("BT_GENERAL_CHANNEL", "general"));

const out = [];
for (const [netuid, info] of Object.entries(discovery)) {
  if (!info.repo) continue;
  const maintainers = new Set((info.maintainers ?? []).map((m) => m.toLowerCase()));
  if (maintainers.size === 0) {
    // No maintainers resolved -> we cannot tell maintainer PRs from external ones.
    // Skip rather than post every open PR (would violate the maintainer-only requirement).
    log(`no maintainers for ${info.repo}; skipping (set one in BT_OVERRIDE_FILE to enable)`);
    continue;
  }

  // A subnet channel (info.channelId) or the #general fallback must resolve, else we
  // have nowhere to route the review. Skip WITHOUT advancing state so a transient
  // Discord failure is retried next run rather than silently swallowed.
  const targetChannel = info.channelId ?? generalId;
  if (!targetChannel) {
    log(`no channel to route ${info.repo} (subnet + #general both unresolved); skipping`);
    continue;
  }

  const r = gh([
    "pr",
    "list",
    "--repo",
    info.repo,
    "--state",
    "open",
    "--limit",
    String(LIMIT),
    "--json",
    "number,author,title,url",
  ]);
  if (r.status !== 0) {
    log(`gh pr list failed for ${info.repo}: ${r.stderr.trim()}`);
    continue;
  }
  let prs;
  try {
    prs = JSON.parse(r.stdout);
  } catch {
    log(`unparseable gh output for ${info.repo}`);
    continue;
  }

  const maxNumber = prs.reduce((m, p) => Math.max(m, p.number), 0);
  const lastSeen = prState[info.repo];

  if (lastSeen === undefined) {
    prState[info.repo] = maxNumber; // seed, review nothing this run
    log(`seeded ${info.repo} at PR #${maxNumber}`);
    continue;
  }

  for (const p of prs) {
    if (p.number <= lastSeen) continue;
    if (!maintainers.has((p.author?.login ?? "").toLowerCase())) continue;
    out.push({
      netuid: Number(netuid),
      repo: info.repo,
      number: p.number,
      title: p.title,
      author: p.author?.login ?? "unknown",
      url: p.url,
      channelId: targetChannel,
      route: info.channelId ? "subnet" : "general",
    });
  }
  prState[info.repo] = Math.max(lastSeen, maxNumber);
}

writeState(STATE, prState);
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
