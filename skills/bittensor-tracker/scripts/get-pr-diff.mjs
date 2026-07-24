#!/usr/bin/env node
// Fetch a PR diff through the authenticated, token-rotating gh() helper — so the
// review agent never runs `gh` itself (which would be unauthenticated in the gateway
// env, 60 req/hr). Prints the diff to stdout. Args are passed to gh via spawnSync
// (no shell), and repo/number are validated, so there is no injection surface.
//
//   node get-pr-diff.mjs --repo owner/name --number 123
//   node get-pr-diff.mjs owner/name 123

import { gh, log } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const repo = opt("--repo") ?? args.find((a) => /^[\w.-]+\/[\w.-]+$/.test(a));
const number = opt("--number") ?? args.find((a) => /^\d+$/.test(a));

if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
  process.stderr.write("usage: get-pr-diff.mjs --repo <owner/name> --number <n>\n");
  process.exit(2);
}
if (!number || !/^\d+$/.test(String(number))) {
  process.stderr.write("usage: get-pr-diff.mjs --repo <owner/name> --number <n>\n");
  process.exit(2);
}

const r = gh(["pr", "diff", String(number), "--repo", repo]);
if (r.status !== 0) {
  log(`gh pr diff ${repo}#${number} failed: ${r.stderr.trim()}`);
  process.exit(1);
}
process.stdout.write(r.stdout);
