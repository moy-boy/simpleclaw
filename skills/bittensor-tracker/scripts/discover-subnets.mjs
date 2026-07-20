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
//      BT_GENERAL_CHANNEL, BT_OVERRIDE_FILE (json: { "<netuid>": {repo, maintainers[]} })

import fs from "node:fs";
import {
  env,
  gh,
  listGuildChannels,
  log,
  netuidFromChannelName,
  readState,
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

/** Best-effort: scrape the free taostats subnet page for a github repo link. */
async function scrapeRepo(netuid) {
  const url = `https://taostats.io/subnets/${netuid}/`;
  try {
    const res = await fetch(url, { headers: { "user-agent": "bittensor-tracker" } });
    if (!res.ok) return null;
    const html = await res.text();
    const m = /github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/.exec(html);
    if (!m) return null;
    return m[1].replace(/\.git$/, "").replace(/[).,"']+$/, "");
  } catch {
    return null;
  }
}

/** Best-effort maintainers: public members of the owning org, else the owner. */
function resolveMaintainers(repo) {
  const owner = repo.split("/")[0];
  // Try org public members (works for org-owned repos).
  const members = gh(["api", `orgs/${owner}/public_members`, "--jq", ".[].login"]);
  if (members.status === 0 && members.stdout.trim()) {
    return members.stdout.trim().split("\n").filter(Boolean);
  }
  // Fall back to the owner login (user-owned repo).
  return [owner];
}

async function refresh() {
  const overrides = loadOverrides();
  const announce = env("BT_ANNOUNCE_CHANNEL", "announcement");
  const general = env("BT_GENERAL_CHANNEL", "general");

  const channels = await listGuildChannels();
  const map = {};
  for (const ch of channels) {
    if (ch.name === announce || ch.name === general) continue;
    const netuid = netuidFromChannelName(ch.name);
    if (netuid == null) continue;

    const ov = overrides[String(netuid)] ?? {};
    const repo = ov.repo ?? (await scrapeRepo(netuid));
    const maintainers = ov.maintainers ?? (repo ? resolveMaintainers(repo) : []);
    map[netuid] = { channelId: ch.id, channelName: ch.name, repo: repo ?? null, maintainers };
    log(`sn${netuid} -> #${ch.name} repo=${repo ?? "?"} maintainers=${maintainers.length}`);
  }

  writeState(CACHE_FILE, { map, refreshedAt: new Date().toISOString() });
  return map;
}

const cachedOnly = process.argv.includes("--cached");
const result = cachedOnly ? (readState(CACHE_FILE, { map: {} }).map ?? {}) : await refresh();
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
