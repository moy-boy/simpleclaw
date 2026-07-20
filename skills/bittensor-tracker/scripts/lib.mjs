// Shared helpers for the Bittensor subnet tracker bot (registration + PR monitors).
// Dependency-free: Node built-ins, global fetch, and shelling out to `gh` / `openclaw`.
// Every secret/setting is env-driven so the logic can be built and exercised before
// real tokens exist (see .env.example).

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
  fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`);
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
  // type 0 = text channel; keep name + id.
  return (await res.json()).filter((c) => c.type === 0).map((c) => ({ id: c.id, name: c.name }));
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

/** Post a message to a Discord channel id via the openclaw send CLI (integrated path). */
export function sendToChannel(channelId, message) {
  const bin = env("OPENCLAW_BIN", "openclaw");
  const r = run(bin, [
    "message",
    "send",
    "--channel",
    "discord",
    "--target",
    `channel:${channelId}`,
    "--message",
    message,
  ]);
  if (r.status !== 0) {
    throw new Error(`send to channel ${channelId} failed: ${r.stderr || r.stdout}`);
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
    const rateLimited =
      /rate limit|API rate limit exceeded|403/i.test(r.stderr) && /rate|limit/i.test(r.stderr);
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
