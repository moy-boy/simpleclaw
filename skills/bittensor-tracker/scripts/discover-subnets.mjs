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

// taostats subnet pages embed the on-chain SubnetIdentity (netuid, subnet_name, github_repo)
// for EVERY subnet in one payload — the authoritative, keyless source. Fetch once, cache the map.
let _identityMap = null;
async function taostatsIdentityMap() {
  if (_identityMap) return _identityMap;
  _identityMap = {};
  const url = env("BT_TAOSTATS_URL", "https://taostats.io/subnets/1/");
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) {
      log(`taostats identity fetch ${url} -> ${res.status}`);
      return _identityMap;
    }
    const html = (await res.text()).replaceAll('\\"', '"'); // RSC payload escapes quotes
    const re = /"netuid":\s*(\d+)\s*,\s*"subnet_name":\s*"[^"]*"\s*,\s*"github_repo":\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
      const repo = normalizeRepo(m[2]);
      if (repo && !_identityMap[m[1]]) _identityMap[m[1]] = repo;
    }
  } catch (e) {
    log(`taostats identity fetch failed: ${e.message}`);
  }
  return _identityMap;
}

/** Resolve the subnet's repo from taostats' embedded SubnetIdentity (keyless, reliable).
 *  Optional BT_REPO_RESOLVER_CMD (e.g. btcli) is a fallback; the override file wins upstream. */
async function resolveRepo(netuid) {
  // Harden against command injection: netuid must be a plain non-negative integer.
  const nid = Number(netuid);
  if (!Number.isInteger(nid) || nid < 0) {
    log(`invalid netuid ${JSON.stringify(netuid)}; skipping repo resolve`);
    return null;
  }

  const fromTaostats = (await taostatsIdentityMap())[nid];
  if (fromTaostats) return fromTaostats;

  // Fallback: a resolver command. netuid is passed via $NETUID (never shell-interpolated);
  // {netuid} substitution only ever inserts the validated integer.
  const cmd = env("BT_REPO_RESOLVER_CMD");
  if (cmd) {
    const r = run("bash", ["-lc", cmd.replaceAll("{netuid}", String(nid))], {
      env: { ...process.env, NETUID: String(nid) },
    });
    const repo = r.status === 0 ? normalizeRepo(r.stdout) : null;
    if (repo) return repo;
  }
  log(`no repo for sn${nid} (taostats identity + resolver empty); set BT_OVERRIDE_FILE`);
  return null;
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
