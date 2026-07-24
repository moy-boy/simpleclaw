#!/usr/bin/env node
// Post a message to a Discord channel id. The PR-review cron agent uses this to
// publish its review — it pipes the review text on stdin (multiline-safe) or passes
// --text. Mentions are neutralized + disabled at the API level inside sendToChannel.
//
//   printf '%s' "<review>" | node post-message.mjs --channel <channelId>
//   node post-message.mjs --channel <channelId> --text "one-liner"

import fs from "node:fs";
import { log, sendToChannel } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const channelId = opt("--channel");
if (!channelId) {
  process.stderr.write("usage: post-message.mjs --channel <id> [--text <msg> | stdin]\n");
  process.exit(2);
}

const message = opt("--text") ?? fs.readFileSync(0, "utf8"); // fd 0 = stdin
if (!message.trim()) {
  process.stderr.write("refusing to post an empty message\n");
  process.exit(2);
}

await sendToChannel(channelId, message);
log(`posted ${message.length} chars to channel ${channelId}`);
