#!/usr/bin/env node
// P0 discovery: Discord channels -> tracked subnets -> { channelId, repo, maintainers }.
// The Discord server is the source of truth for WHICH subnets to track. Repo +
// maintainers are resolved best-effort (override file wins) and cached.
//
// Usage:
//   node discover-subnets.mjs            # refresh + print discovery map (JSON)
//   node discover-subnets.mjs --cached   # print last cached map without refetching
//
// Env: DISCORD_BOT_TOKEN, BT_GUILD_ID, BT_CHANNEL_PATTERN, BT_ANNOUNCE_CHANNEL,
//      BT_GENERAL_CHANNEL, BT_EXTRA_NETUIDS (no-channel watchlist -> #general),
//      BT_OVERRIDE_FILE (json: { "<netuid>": {repo, maintainers[]} })

import fs from "node:fs";
import {
  env,
  envInt,
  gh,
  listGuildChannels,
  log,
  netuidFromChannelName,
  readState,
  run,
  writeState,
} from "./lib.mjs";

const CACHE_FILE = "discovery-cache.json";

function loadOverrides() {
  const file = env("BT_OVERRIDE_FILE");
  if (!file) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    log(`override file unreadable (${file}): ${e.message}`);
    return {};
  }
}

/** Normalize "https://github.com/owner/repo(.git)", "github.com/owner/repo", or
 *  "owner/repo" -> "owner/repo". */
function normalizeRepo(text) {
  const stripped = String(text)
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/^github\.com\//, "");
  const m = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/.exec(stripped);
  return m ? m[1].replace(/\.git$/, "").replace(/[).,"'\s]+$/, "") : null;
}

/** Resolve the subnet's repo. The authoritative source is the on-chain SubnetIdentity
 *  (github_repo the owner registered); reach it via BT_REPO_RESOLVER_CMD (default: btcli).
 *  `{netuid}` is substituted. Falls back to the (unreliable) taostats scrape. */
async function resolveRepo(netuid) {
  // Harden against command injection: netuid must be a plain non-negative integer, and we pass
  // it to the child via $NETUID (never interpolated as shell syntax).
  const nid = Number(netuid);
  if (!Number.isInteger(nid) || nid < 0) {
    log(`invalid netuid ${JSON.stringify(netuid)}; skipping repo resolve`);
    return null;
  }
  const cmd =
    env("BT_REPO_RESOLVER_CMD") ??
    "btcli subnets show --netuid \"$NETUID\" 2>/dev/null | grep -oE 'github.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+' | head -1";
  // {netuid} substitution is still supported for custom commands, but only ever inserts the
  // validated integer above.
  const r = run("bash", ["-lc", cmd.replaceAll("{netuid}", String(nid))], {
    env: { ...process.env, NETUID: String(nid) },
  });
  const repo = r.status === 0 ? normalizeRepo(r.stdout) : null;
  if (repo) return repo;
  log(
    `on-chain repo resolver empty for sn${netuid}; falling back to scrape (set BT_OVERRIDE_FILE)`,
  );
  return await scrapeRepo(netuid);
}

/** Last-resort: scrape the taostats page. Unreliable (SPA) — expect overrides to correct it. */
async function scrapeRepo(netuid) {
  try {
    const res = await fetch(`https://taostats.io/subnets/${netuid}/`, {
      headers: { "user-agent": "bittensor-tracker" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const DENY =
      /^(taostats|taostatsio|about|features|topics|sponsors|orgs|marketplace|pricing|login|explore)$/i;
    for (const mm of html.matchAll(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/g)) {
      if (DENY.test(mm[1])) continue;
      return normalizeRepo(`${mm[1]}/${mm[2]}`);
    }
    return null;
  } catch {
    return null;
  }
}

/** The maintainer team = who actually lands code: top repo contributors (by commit count),
 *  with org-members / owner as fallbacks. Override wins upstream. */
function resolveMaintainers(repo) {
  const limit = envInt("BT_MAINTAINERS_LIMIT", 10);
  const contrib = gh([
    "api",
    `repos/${repo}/contributors?per_page=${limit}`,
    "--jq",
    "[.[].login] | map(select(. != null))",
  ]);
  if (contrib.status === 0) {
    try {
      const arr = JSON.parse(contrib.stdout);
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {
      // fall through
    }
  }
  const owner = repo.split("/")[0];
  const members = gh(["api", `orgs/${owner}/public_members`, "--jq", ".[].login"]);
  if (members.status === 0 && members.stdout.trim()) {
    return members.stdout.trim().split("\n").filter(Boolean);
  }
  return [owner];
}

/** Resolve repo + maintainers for a netuid (override wins, else auto-discover). */
async function resolveEntry(netuid, overrides) {
  const ov = overrides[String(netuid)] ?? {};
  const repo = ov.repo ?? (await resolveRepo(netuid));
  const maintainers = ov.maintainers ?? (repo ? resolveMaintainers(repo) : []);
  return { repo: repo ?? null, maintainers };
}

/** Extra subnets to monitor that have no channel (BT_EXTRA_NETUIDS="12,64"). */
function extraWatchlistNetuids() {
  return env("BT_EXTRA_NETUIDS", "")
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter(Number.isFinite);
}

async function refresh() {
  const overrides = loadOverrides();
  const announce = env("BT_ANNOUNCE_CHANNEL", "announcement");
  const general = env("BT_GENERAL_CHANNEL", "general");

  const channels = await listGuildChannels();
  const map = {};

  // 1) Subnets that HAVE a channel -> route PRs to that channel.
  for (const ch of channels) {
    if (ch.name === announce || ch.name === general) continue;
    const netuid = netuidFromChannelName(ch.name);
    if (netuid == null) continue;
    const { repo, maintainers } = await resolveEntry(netuid, overrides);
    map[netuid] = { channelId: ch.id, channelName: ch.name, repo, maintainers };
    log(`sn${netuid} -> #${ch.name} repo=${repo ?? "?"} maintainers=${maintainers.length}`);
  }

  // 2) Watchlist subnets WITHOUT a channel -> route their PRs to #general.
  for (const netuid of extraWatchlistNetuids()) {
    if (map[netuid]) continue; // already covered by a channel
    const { repo, maintainers } = await resolveEntry(netuid, overrides);
    map[netuid] = { channelId: null, channelName: null, repo, maintainers };
    log(
      `sn${netuid} (watchlist -> #general) repo=${repo ?? "?"} maintainers=${maintainers.length}`,
    );
  }

  writeState(CACHE_FILE, { map, refreshedAt: new Date().toISOString() });
  return map;
}

// Refresh is expensive (taostats scrape + gh per subnet), so it's TTL-gated: calling this
// every PR poll is cheap (returns cache) and it only re-resolves every BT_DISCOVERY_TTL_MINUTES.
//   --cached  never refresh (cache only)   --force  always refresh
const cachedOnly = process.argv.includes("--cached");
const force = process.argv.includes("--force");
const cached = readState(CACHE_FILE, null);
const ttlMs = envInt("BT_DISCOVERY_TTL_MINUTES", 360) * 60_000;
const fresh = Boolean(cached?.refreshedAt) && Date.now() - Date.parse(cached.refreshedAt) < ttlMs;

let result;
if (cachedOnly || (fresh && !force)) {
  if (fresh && !cachedOnly) log("discovery cache fresh; skipping refresh (--force to override)");
  result = cached?.map ?? {};
} else {
  result = await refresh();
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
