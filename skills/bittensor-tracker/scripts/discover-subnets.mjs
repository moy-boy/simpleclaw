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
    // Skip github links that are taostats' own / social / docs chrome, not the subnet repo.
    // (Best-effort only — set BT_OVERRIDE_FILE for anything this resolves wrong.)
    const DENY =
      /^(taostats|taostatsio|about|features|topics|sponsors|orgs|marketplace|pricing|login|explore)$/i;
    for (const mm of html.matchAll(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/g)) {
      const owner = mm[1];
      if (DENY.test(owner)) continue;
      return `${owner}/${mm[2]}`.replace(/\.git$/, "").replace(/[).,"']+$/, "");
    }
    return null;
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

/** Resolve repo + maintainers for a netuid (override wins, else best-effort). */
async function resolveEntry(netuid, overrides) {
  const ov = overrides[String(netuid)] ?? {};
  const repo = ov.repo ?? (await scrapeRepo(netuid));
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
