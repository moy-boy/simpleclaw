#!/usr/bin/env node
// Monitor 2: detect newly-registered subnets and (optionally) announce them.
//
//   node check-new-subnets.mjs             # print JSON { seeded, new: [netuids] }; update state
//   node check-new-subnets.mjs --post-basic # also post a one-line announcement per new subnet
//
// First run seeds the known set and announces nothing (avoids spamming all existing subnets).
// An empty/failed source never overwrites known state (avoids false "new" next run). In
// --post-basic mode it also posts a one-time alert to BT_ALERT_CHANNEL when the source
// goes empty (taostats outage/format drift) and one when it recovers — transition-gated.

import { getNetuids } from "./fetch-netuids.mjs";
import {
  acquireLock,
  channelIdByName,
  env,
  log,
  readState,
  sendToChannel,
  writeState,
} from "./lib.mjs";

if (!acquireLock("registration-monitor")) {
  log("registration-monitor already running; skipping this run");
  process.exit(0);
}

const STATE = "registration-state.json";
const HEALTH = "source-health.json";
const postBasic = process.argv.includes("--post-basic");

const alertChannel = () =>
  channelIdByName(env("BT_ALERT_CHANNEL", env("BT_GENERAL_CHANNEL", "general")));

/** Best-effort alert post; never throws (a failed alert must not crash the monitor). */
async function tryAlert(message) {
  try {
    const chId = await alertChannel();
    if (!chId) return log("alert channel unresolved; alert not posted");
    await sendToChannel(chId, message);
  } catch (e) {
    log(`alert post failed: ${e.message}`);
  }
}

// Notify ONCE when the subnet source starts/stops returning data (transition-gated
// via source-health.json), so a taostats outage/format drift surfaces instead of the
// bot silently detecting nothing hour after hour.
async function markSourceFailing() {
  if (readState(HEALTH, { failing: false }).failing) return; // already alerted this episode
  writeState(HEALTH, { failing: true, since: new Date().toISOString() });
  await tryAlert(
    "⚠️ **bittensor-tracker: subnet source returned no data** — new-subnet detection is paused until it recovers (likely a taostats availability or format change). Check `BT_TAOSTATS_URL` and the identity parser.",
  );
}
async function markSourceHealthy() {
  if (!readState(HEALTH, { failing: false }).failing) return; // already healthy
  writeState(HEALTH, { failing: false, recoveredAt: new Date().toISOString() });
  await tryAlert(
    "✅ **bittensor-tracker: subnet source recovered** — new-subnet detection resumed.",
  );
}

const current = await getNetuids();
if (!current.length) {
  log("source returned no netuids; leaving state untouched");
  if (postBasic) await markSourceFailing();
  process.stdout.write(`${JSON.stringify({ seeded: false, new: [], error: "empty-source" })}\n`);
  process.exit(0);
}
if (postBasic) await markSourceHealthy();

const state = readState(STATE, { knownNetuids: [] });
const known = new Set(state.knownNetuids ?? []);

let result;
if (known.size === 0) {
  // First run: seed, announce nothing.
  writeState(STATE, { knownNetuids: current, seededAt: new Date().toISOString() });
  result = { seeded: true, new: [] };
} else {
  const fresh = current.filter((n) => !known.has(n));
  writeState(STATE, {
    knownNetuids: [...new Set([...known, ...current])].sort((a, b) => a - b),
    updatedAt: new Date().toISOString(),
  });
  result = { seeded: false, new: fresh };

  if (postBasic && fresh.length) {
    const chId = await channelIdByName(env("BT_ANNOUNCE_CHANNEL", "announcement"));
    if (!chId) {
      log("announce channel not found; skipping post");
    } else {
      for (const netuid of fresh) {
        await sendToChannel(
          chId,
          `🆕 **New Bittensor subnet registered: SN${netuid}** — https://taostats.io/subnets/${netuid}`,
        );
        log(`announced sn${netuid}`);
      }
    }
  }
}

process.stdout.write(`${JSON.stringify(result)}\n`);
