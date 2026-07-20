---
name: bittensor-tracker
description: "Monitor Bittensor subnet GitHub repos for maintainer PRs (deep-review + post to the subnet's Discord channel) and detect newly-registered subnets (announce them). Discovery is driven by the Discord server's channels."
homepage: https://taostats.io
metadata:
  {
    "openclaw":
      {
        "emoji": "🛰️",
        "requires": { "bins": ["node", "gh"] },
        "install":
          [
            {
              "id": "apt",
              "kind": "apt",
              "packages": ["gh"],
              "bins": ["gh"],
              "label": "Install GitHub CLI (apt)",
            },
          ],
      },
  }
---

# Bittensor subnet tracker

Two scheduled monitors for a Discord server that tracks Bittensor subnets. The
**server's channels are the source of truth** for which subnets to track: a text
channel whose name matches `BT_CHANNEL_PATTERN` (default `^subnet-(\d+)$`) means
"track subnet N and post its updates here."

All configuration is environment-driven — see `.env.example`. Nothing here needs
live tokens to reason about; wire the env at deploy time.

Scripts live in `scripts/` and are deterministic (detection + state). This skill
(the agent) does the parts that need judgment: **reviewing a PR** and **writing a
subnet briefing**.

## Monitor 1 — maintainer PR review (cron, every `BT_PR_POLL_MINUTES`)

1. Refresh discovery (cheap, cached): `node scripts/discover-subnets.mjs > /dev/null`
   (maps each `subnet-N` channel → repo + maintainers; override file wins).
2. Detect new maintainer PRs: `node scripts/check-new-prs.mjs`
   → prints a JSON array of `{ netuid, repo, number, title, author, url, channelId, route }`.
3. For **each** item:
   - Fetch the diff: `gh pr diff <number> --repo <repo>`.
   - **Deeply review it** — what changed, why it matters, and any correctness/security
     risk. Be thorough in your reasoning but concise in the post (Discord-sized).
   - Post to the routed channel:
     `openclaw message send --channel discord --target channel:<channelId> --message "<summary>"`
     (if `channelId` is empty, use the `#general` channel id).
   - Suggested format:
     > **[SN{netuid}] Maintainer PR #{number}: {title}** — @{author}
     > {2–4 sentences: what changed + why it matters}
     > **Risk:** {correctness/security notes, or "none observed"}
     > {url}

`check-new-prs.mjs` already filtered to maintainer authors and unseen PR numbers,
and advanced state — so only review what it returns. Do not re-post older PRs.

## Monitor 2 — new subnet registration (cron, every `BT_REG_POLL_MINUTES`)

1. Detect: `node scripts/check-new-subnets.mjs` → `{ seeded, new: [netuids] }`.
   - `seeded: true` means first run — announce nothing.
2. For each netuid in `new`:
   - Produce a briefing using the **bittensor-subnet** skill (netuid, owner, what it
     does, reg cost, GitHub, TaoStats link).
   - Post to the announcement channel:
     `openclaw message send --channel discord --target channel:<announceId> --message "<briefing>"`
   - Resolve `<announceId>` from the channel named `BT_ANNOUNCE_CHANNEL`.

For a zero-LLM fallback (basic one-line announcement, no briefing), run
`node scripts/check-new-subnets.mjs --post-basic` instead and skip the agent step.

## Notes

- **Netuid source** (`BT_SUBNET_SOURCE_*`) is free/no-key and swappable — a chain RPC
  command, a JSON endpoint, or the default taostats scrape. See `scripts/fetch-netuids.mjs`.
- **GitHub tokens**: set `GITHUB_TOKENS` (comma-separated) — the scripts round-robin and
  advance on rate-limit, so many repos stay pollable.
- **Repo/maintainer overrides**: set `BT_OVERRIDE_FILE` to a JSON map
  `{ "<netuid>": { "repo": "owner/name", "maintainers": ["login", ...] } }` for any subnet
  auto-discovery can't resolve.
- State lives under the OpenClaw state dir (`bittensor-bot/`): `registration-state.json`,
  `pr-state.json`, `discovery-cache.json`.
