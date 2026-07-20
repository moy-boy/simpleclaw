#!/usr/bin/env node
// Return the current set of registered Bittensor netuids as a JSON array.
// Free / no-key by design. Source is configurable so you can swap in a chain RPC
// without changing the diff/announce pipeline:
//
//   BT_SUBNET_SOURCE_CMD  a shell command that prints a JSON array of netuids     (highest priority)
//   BT_SUBNET_SOURCE_URL  a URL returning JSON array, or HTML to scrape /subnets/N
//   (default)             scrape https://taostats.io/subnets/ (best-effort, no key)
//
// Exported as getNetuids() so check-new-subnets.mjs can import it.

import { spawnSync } from "node:child_process";
import { env, log } from "./lib.mjs";

function uniqSortedInts(list) {
  return [...new Set(list.map((n) => Number.parseInt(n, 10)).filter(Number.isFinite))].sort(
    (a, b) => a - b,
  );
}

function scrapeNetuids(html) {
  // Matches /subnets/5 or "netuid":5 style occurrences.
  const ids = [];
  for (const m of html.matchAll(/\/subnets\/(\d+)\b/g)) ids.push(m[1]);
  for (const m of html.matchAll(/"netuid"\s*:\s*(\d+)/g)) ids.push(m[1]);
  return ids;
}

export async function getNetuids() {
  const cmd = env("BT_SUBNET_SOURCE_CMD");
  if (cmd) {
    const r = spawnSync("bash", ["-lc", cmd], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`BT_SUBNET_SOURCE_CMD failed: ${r.stderr}`);
    const parsed = JSON.parse(r.stdout);
    return uniqSortedInts(Array.isArray(parsed) ? parsed : (parsed.netuids ?? []));
  }

  const url = env("BT_SUBNET_SOURCE_URL", "https://taostats.io/subnets/");
  const res = await fetch(url, { headers: { "user-agent": "bittensor-tracker" } });
  if (!res.ok) throw new Error(`subnet source ${url} -> ${res.status}`);
  const body = await res.text();
  try {
    const json = JSON.parse(body);
    const arr = Array.isArray(json) ? json : (json.netuids ?? json.data ?? []);
    const nums = arr.map((x) => (typeof x === "object" ? x.netuid : x));
    if (nums.length) return uniqSortedInts(nums);
  } catch {
    // not JSON -> scrape
  }
  const scraped = uniqSortedInts(scrapeNetuids(body));
  if (!scraped.length) log("warning: no netuids parsed from source (check BT_SUBNET_SOURCE_*)");
  return scraped;
}

// CLI: print the array.
if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${JSON.stringify(await getNetuids())}\n`);
}
