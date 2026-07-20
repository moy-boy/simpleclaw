#!/usr/bin/env node
// Monitor 2: detect newly-registered subnets and (optionally) announce them.
//
//   node check-new-subnets.mjs             # print JSON { seeded, new: [netuids] }; update state
//   node check-new-subnets.mjs --post-basic # also post a one-line announcement per new subnet
//
// First run seeds the known set and announces nothing (avoids spamming all existing subnets).
// An empty/failed source never overwrites known state (avoids false "new" next run).

import { getNetuids } from "./fetch-netuids.mjs";
import { channelIdByName, env, log, readState, sendToChannel, writeState } from "./lib.mjs";

const STATE = "registration-state.json";

const current = await getNetuids();
if (!current.length) {
  log("source returned no netuids; leaving state untouched");
  process.stdout.write(`${JSON.stringify({ seeded: false, new: [], error: "empty-source" })}\n`);
  process.exit(0);
}

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

  if (process.argv.includes("--post-basic") && fresh.length) {
    const chId = await channelIdByName(env("BT_ANNOUNCE_CHANNEL", "announcement"));
    if (!chId) {
      log("announce channel not found; skipping post");
    } else {
      for (const netuid of fresh) {
        sendToChannel(
          chId,
          `🆕 **New Bittensor subnet registered: SN${netuid}** — https://taostats.io/subnets/${netuid}`,
        );
        log(`announced sn${netuid}`);
      }
    }
  }
}

process.stdout.write(`${JSON.stringify(result)}\n`);
