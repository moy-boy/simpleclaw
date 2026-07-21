# Bittensor subnet tracker — setup

A Discord bot (running on your OpenClaw gateway) that:

- reviews **maintainer PRs** on tracked subnet repos → posts to the subnet's channel (`#general` fallback);
- announces **newly-registered subnets** → posts to `#announcement`.

Tracked subnets are derived from your Discord channels (e.g. `#subnet-5`). See
[`SKILL.md`](./SKILL.md) for the agent logic and [`.env.example`](./.env.example) for config.

## 1. Discord bot

1. Create an application + bot at <https://discord.com/developers>, copy the **bot token**.
2. Enable the **Message Content** intent (and Server Members if you want member-based maintainer checks).
3. Invite the bot with **only** **View Channels, Send Messages, Read Message History**. Do **NOT** grant
   **Mention Everyone** or **Administrator** — the bot posts untrusted PR content, and this prevents a
   malicious PR title/body from mass-pinging your server (see `SKILL.md` → Security).
4. Register it as OpenClaw's Discord account:
   ```bash
   openclaw channels add --channel discord --token "$DISCORD_BOT_TOKEN"
   ```

## 2. Environment

Copy `.env.example` into your gateway environment and fill it in. The important knobs:

- `DISCORD_BOT_TOKEN`, `BT_GUILD_ID`, `BT_CHANNEL_PATTERN` (match your real channel names).
- `BT_REVIEW_MODEL` — provider/model for reviews (`claude-cli/*`, `anthropic/*`, or `openai-codex/*`).
- `GITHUB_TOKENS` — one or more (comma-separated) for PR polling.
- `BT_SUBNET_SOURCE_CMD` or `BT_SUBNET_SOURCE_URL` — free/no-key netuid source.

## 3. First run (seed state without spamming)

Both monitors seed silently on first run (announce/review nothing), so run each once to
establish a baseline before scheduling:

```bash
node skills/bittensor-tracker/scripts/discover-subnets.mjs      # build the subnet map
node skills/bittensor-tracker/scripts/check-new-subnets.mjs     # seed known netuids
node skills/bittensor-tracker/scripts/check-new-prs.mjs         # seed last-seen PR per repo
```

## 4. Schedule the two monitors

```bash
# Monitor 2 — new subnet registration -> #announcement
openclaw cron add --name bt-registration \
  --every "${BT_REG_POLL_MINUTES:-45}m" --session isolated --tools exec \
  --model "$BT_REVIEW_MODEL" --timeout-seconds 300 \
  --message "Use the bittensor-tracker skill, Monitor 2: run scripts/check-new-subnets.mjs; for each netuid in .new, write a briefing via the bittensor-subnet skill and post it to the BT_ANNOUNCE_CHANNEL channel with 'openclaw message send'. If seeded=true or new is empty, do nothing."

# Monitor 1 — maintainer PR review -> subnet channel (or #general)
openclaw cron add --name bt-pr-review \
  --every "${BT_PR_POLL_MINUTES:-10}m" --session isolated --tools exec \
  --model "$BT_REVIEW_MODEL" --timeout-seconds 900 \
  --message "Use the bittensor-tracker skill, Monitor 1: run scripts/discover-subnets.mjs then scripts/check-new-prs.mjs; for each returned PR, fetch the diff with 'gh pr diff', deeply review it, and post a concise summary to its channelId with 'openclaw message send'. Review only what the script returns."
```

Check them with `openclaw cron list` / `openclaw cron status`.

## 5. Overrides (optional)

When taostats can't resolve a repo/maintainers for a subnet, add it to a JSON file and point
`BT_OVERRIDE_FILE` at it:

```json
{ "5": { "repo": "opentensor/text-prompting", "maintainers": ["alice", "bob"] } }
```

## Watchlist (subnets without a channel)

Tracked subnets come from your channels. To also monitor subnets that have **no** channel — their PRs
post to `#general` — list their netuids in `BT_EXTRA_NETUIDS` (e.g. `BT_EXTRA_NETUIDS=12,64`).

## Notes

- State lives under `$OPENCLAW_STATE_DIR/bittensor-bot/` (`registration-state.json`, `pr-state.json`, `discovery-cache.json`).
- Zero-LLM fallback for announcements: `check-new-subnets.mjs --post-basic`.
- The detection scripts run offline (no tokens) for testing; Discord/GitHub calls degrade gracefully.
