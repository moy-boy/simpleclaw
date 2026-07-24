// Shared helpers for the Bittensor subnet tracker bot (registration + PR monitors).
// Dependency-free: Node built-ins, global fetch, and shelling out to `gh` / `openclaw`.
// Every secret/setting is env-driven so the logic can be built and exercised before
// real tokens exist (see .env.example).

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Env file loader. Cron jobs run as children of the gateway and inherit ITS
// environment, which may not carry BT_*/GITHUB_TOKENS/DISCORD_BOT_TOKEN. So we
// load a dotenv-style file as a FALLBACK — a real process.env value always wins,
// so a systemd EnvironmentFile or a `source .env.dev` shell keeps precedence.
// Location: $BT_ENV_FILE, else the nearest .env.dev / .env walking up from here.
// ---------------------------------------------------------------------------

/** Parse one KEY=VALUE line: strips surrounding quotes and inline `#` comments.
 *  Comment detection runs on the RAW remainder (before trimming) so an empty value
 *  with a trailing comment (`KEY=   # note`) parses to "" rather than the comment. */
function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq < 1) return null;
  const key = trimmed.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  const raw = trimmed.slice(eq + 1);
  const quoted = raw.replace(/^\s+/, "");
  const quote = quoted[0];
  if (quote === '"' || quote === "'") {
    const close = quoted.indexOf(quote, 1);
    return [key, close === -1 ? quoted.slice(1) : quoted.slice(1, close)];
  }
  const comment = raw.search(/(^|\s)#/); // a # at start or after whitespace begins a comment
  return [key, (comment === -1 ? raw : raw.slice(0, comment)).trim()];
}

function findEnvFile() {
  const explicit = process.env.BT_ENV_FILE;
  if (explicit) return fs.existsSync(explicit) ? explicit : null;
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth++) {
    for (const name of [".env.dev", ".env"]) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadEnvFile() {
  const file = findEnvFile();
  if (!file) return;
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const kv = parseEnvLine(line);
    if (!kv) continue;
    const [key, value] = kv;
    const current = process.env[key];
    if (current === undefined || current === "") process.env[key] = value; // never override real env
  }
}

loadEnvFile();

export function env(name, fallback = undefined) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export function envInt(name, fallback) {
  const n = Number.parseInt(env(name, ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Resolve the bot state directory (BT_STATE_DIR > OPENCLAW_STATE_DIR/bittensor-bot > ~/.openclaw). */
export function stateDir() {
  const base =
    env("BT_STATE_DIR") ??
    (env("OPENCLAW_STATE_DIR")
      ? path.join(env("OPENCLAW_STATE_DIR"), "bittensor-bot")
      : path.join(os.homedir(), ".openclaw", "bittensor-bot"));
  fs.mkdirSync(base, { recursive: true });
  return base;
}

export function readState(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(stateDir(), file), "utf8"));
  } catch {
    return fallback;
  }
}

export function writeState(file, value) {
  const p = path.join(stateDir(), file);
  // Atomic: write to a temp file then rename, so a crash mid-write can't corrupt state.
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, p);
  return p;
}

/** Run a command, return {status, stdout, stderr}. Never throws on non-zero. */
export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

// ---------------------------------------------------------------------------
// Discord (bot token from env; list via REST, send via the openclaw CLI so the
// bot honors the configured discord account + streaming/formatting policy).
// ---------------------------------------------------------------------------

const DISCORD_API = "https://discord.com/api/v10";

export async function listGuildChannels() {
  const token = env("DISCORD_BOT_TOKEN");
  const guild = env("BT_GUILD_ID");
  if (!token || !guild) {
    throw new Error("DISCORD_BOT_TOKEN and BT_GUILD_ID are required to list channels");
  }
  const res = await fetch(`${DISCORD_API}/guilds/${guild}/channels`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Discord list channels failed: ${res.status} ${await res.text()}`);
  }
  // 0 = text, 5 = announcement/news — both are postable text channels (a server's
  // #announcement is frequently a News channel, which would be missed if we only kept 0).
  const POSTABLE = new Set([0, 5]);
  return (await res.json())
    .filter((c) => POSTABLE.has(c.type))
    .map((c) => ({ id: c.id, name: c.name }));
}

let _channelCache = null;
/** Resolve a channel name (e.g. "announcement") to its id; cached per process.
 *  Returns null (never throws) when Discord isn't configured, so detection scripts
 *  run offline before tokens are wired. */
export async function channelIdByName(name) {
  if (!_channelCache) {
    try {
      _channelCache = new Map((await listGuildChannels()).map((c) => [c.name, c.id]));
    } catch (e) {
      log(`channel resolve unavailable: ${e.message}`);
      _channelCache = new Map();
    }
  }
  return _channelCache.get(name) ?? null;
}

/** Neutralize mass-ping mentions so untrusted PR content (titles/diffs) can't @everyone the server.
 *  Defense-in-depth on top of NOT granting the bot the "Mention Everyone" permission. */
export function neutralizeMentions(text) {
  return String(text)
    .replace(/@(everyone|here)\b/gi, "@​$1")
    .replace(/<@&(\d+)>/g, "[role:$1]");
}

/** Split text into Discord-sized chunks (<=2000 chars), preferring line boundaries.
 *  A single line longer than `max` is hard-split (never truncated) so nothing is lost. */
export function chunkForDiscord(text, max = 1900) {
  const chunks = [];
  let buf = "";
  const flush = () => {
    if (buf) chunks.push(buf);
    buf = "";
  };
  for (const rawLine of String(text).split("\n")) {
    let line = rawLine;
    while (line.length > max) {
      flush();
      chunks.push(line.slice(0, max));
      line = line.slice(max);
    }
    if (buf.length + line.length + 1 > max) {
      flush();
      buf = line;
    } else {
      buf = buf ? `${buf}\n${line}` : line;
    }
  }
  flush();
  return chunks.length ? chunks : [""];
}

/** Post a message to a Discord channel via the bot REST API — self-contained, no
 *  `openclaw` binary on PATH required. Mentions are neutralized in the text AND
 *  disabled at the API level (allowed_mentions.parse=[]) so untrusted PR content
 *  can never ping the server. Long reviews are split across messages. */
export async function sendToChannel(channelId, message) {
  const token = env("DISCORD_BOT_TOKEN");
  if (!token) throw new Error("DISCORD_BOT_TOKEN is required to post to Discord");
  for (const content of chunkForDiscord(neutralizeMentions(String(message)))) {
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    if (!res.ok) {
      throw new Error(`post to channel ${channelId} failed: ${res.status} ${await res.text()}`);
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Channel-name -> netuid parsing (configurable regex; first capture group = netuid).
// ---------------------------------------------------------------------------

export function netuidFromChannelName(name) {
  const pattern = env("BT_CHANNEL_PATTERN", "^subnet-(\\d+)$");
  const m = new RegExp(pattern).exec(name.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// taostats embedded on-chain SubnetIdentity: the single keyless source of truth
// for BOTH "which netuids are registered" and "each subnet's github repo". The
// subnet page ships every subnet's { netuid, subnet_name, github_repo } in one
// RSC payload (quotes backslash-escaped). Fetched once, cached per process, so
// discovery and the registration monitor share one authoritative request.
// ---------------------------------------------------------------------------

const TAOSTATS_IDENTITY_RE =
  /"netuid":\s*(\d+)\s*,\s*"subnet_name":\s*"[^"]*"\s*,\s*"github_repo":\s*"([^"]+)"/g;

let _identity = null;
/** Returns [{ netuid:number, repo:string }] for every subnet taostats knows.
 *  Empty array (never throws) when the source is unreachable, so callers can
 *  apply their own empty-source guards instead of crashing a cron run. */
export async function taostatsIdentity() {
  if (_identity) return _identity;
  const url = env("BT_TAOSTATS_URL", "https://taostats.io/subnets/1/");
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) {
      log(`taostats identity fetch ${url} -> ${res.status}`);
      return (_identity = []);
    }
    const html = (await res.text()).replaceAll('\\"', '"'); // RSC payload escapes quotes
    const out = [];
    const seen = new Set();
    for (const m of html.matchAll(TAOSTATS_IDENTITY_RE)) {
      const netuid = Number.parseInt(m[1], 10);
      if (!Number.isInteger(netuid) || seen.has(netuid)) continue;
      seen.add(netuid);
      out.push({ netuid, repo: m[2] });
    }
    return (_identity = out);
  } catch (e) {
    log(`taostats identity fetch failed: ${e.message}`);
    return (_identity = []);
  }
}

// ---------------------------------------------------------------------------
// GitHub token rotation: round-robin across GITHUB_TOKENS, advance on rate-limit.
// ---------------------------------------------------------------------------

let ghTokenIndex = 0;
export function ghTokens() {
  return (env("GITHUB_TOKENS", "") || env("GITHUB_TOKEN", ""))
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Run `gh <args>` with the current rotating token; on rate-limit, advance and retry once per token. */
export function gh(args) {
  const tokens = ghTokens();
  const attempts = tokens.length || 1;
  for (let i = 0; i < attempts; i++) {
    const token = tokens.length ? tokens[(ghTokenIndex + i) % tokens.length] : undefined;
    const gexecEnv = token ? { ...process.env, GH_TOKEN: token, GITHUB_TOKEN: token } : process.env;
    const r = run(env("GH_BIN", "gh"), args, { env: gexecEnv });
    // Only a genuine rate-limit should rotate tokens; a bare 403 (permission) is a real error.
    const rateLimited = /rate limit|rate-limit|API rate limit exceeded/i.test(r.stderr);
    if (r.status === 0) {
      ghTokenIndex = tokens.length ? (ghTokenIndex + i) % tokens.length : 0;
      return r;
    }
    if (!rateLimited) return r; // real error, surface it
  }
  return { status: 1, stdout: "", stderr: "all GitHub tokens rate-limited or failed" };
}

export function log(...args) {
  process.stderr.write(`[bittensor-tracker] ${args.join(" ")}\n`);
}

/** Best-effort single-runner lock so overlapping cron runs don't double-post / race state.
 *  Returns a release() fn, or null if a live run already holds the lock. Stale locks
 *  (older than staleMinutes — e.g. a crashed run) are reclaimed. */
export function acquireLock(name, staleMinutes = 30) {
  const p = path.join(stateDir(), `${name}.lock`);
  const claim = () => {
    fs.writeFileSync(p, `${process.pid} ${Date.now()}\n`);
    const release = () => {
      try {
        fs.unlinkSync(p);
      } catch {
        // already gone
      }
    };
    process.once("exit", release);
    return release;
  };
  try {
    fs.writeFileSync(p, `${process.pid} ${Date.now()}\n`, { flag: "wx" }); // atomic create
    process.once("exit", () => {
      try {
        fs.unlinkSync(p);
      } catch {
        // already gone
      }
    });
    return () => {
      try {
        fs.unlinkSync(p);
      } catch {
        // already gone
      }
    };
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    const ts = Number(fs.readFileSync(p, "utf8").trim().split(/\s+/)[1] ?? 0);
    if (Date.now() - ts > staleMinutes * 60_000) {
      log(`reclaiming stale lock ${name}.lock`);
      return claim();
    }
    return null; // held by a live run
  }
}
