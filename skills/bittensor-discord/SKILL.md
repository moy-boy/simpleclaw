---
name: bittensor-discord
description: "Pull recent activity from Bittensor Discord channels (announcements, subnet-specific channels, dev chatter) and summarize what's moving."
homepage: https://discord.gg/bittensor
metadata:
  {
    "openclaw":
      {
        "emoji": "💬",
        "requires": { "bins": ["curl", "jq"], "env": ["BITTENSOR_DISCORD_BOT_TOKEN"] },
        "install":
          [
            {
              "id": "apt",
              "kind": "apt",
              "packages": ["curl", "jq"],
              "bins": ["curl", "jq"],
              "label": "Install curl + jq (apt)",
            },
          ],
      },
  }
---

# Bittensor Discord activity

Pulls recent messages from the Opentensor Foundation Discord (the canonical Bittensor server) and summarizes what's moving in specific channels.

## Trigger phrases

- "what's happening in bittensor discord"
- "discord activity for subnet N"
- "any news in #announcements"
- "summarize bittensor discord today"
- "recent movement in {channel-name}"

## Prerequisite: one-time setup (5 min)

Discord is private — you can't read channels without auth. You need a **Discord bot account** added to the Bittensor server with `View Channels` + `Read Message History` permissions.

1. Go to https://discord.com/developers/applications → **New Application**
2. **Bot** tab → **Add Bot** → copy the **bot token** (long string)
3. **OAuth2 → URL Generator** → scopes: `bot` → permissions: `View Channels`, `Read Message History` → generate URL
4. Open the URL → add the bot to the **Bittensor (Opentensor)** server (you need a server-side moderator to approve if it's invite-locked; the public Bittensor Discord at https://discord.gg/bittensor is generally open)
5. Store the token in OpenClaw's secret store:
   ```bash
   openclaw secrets set BITTENSOR_DISCORD_BOT_TOKEN "<paste token>"
   ```
   (Or export it: `export BITTENSOR_DISCORD_BOT_TOKEN="<token>"` for the gateway service.)

If your token is invalid, the API returns HTTP 401. If the bot isn't in the server, you'll get HTTP 403 on channel queries.

## How to look up channel IDs

Each Discord channel has a numeric ID. To get it:

1. In Discord, **Settings → Advanced → enable Developer Mode**
2. Right-click any channel → **Copy ID**

Cache the channel IDs you care about. Common Bittensor channels (IDs vary — fetch yours):

| Channel                   | Purpose                    | How to use                          |
| ------------------------- | -------------------------- | ----------------------------------- |
| `#announcements`          | Foundation announcements   | Daily check — high-signal           |
| `#general`                | Open chat                  | Sentiment/topic indicator           |
| `#dev`                    | Core dev chatter           | Technical discussions               |
| `#subnet-{N}` (if exists) | Subnet-specific discussion | Use when querying a specific subnet |
| `#validators`             | Validator coordination     | Emission/registration strategy      |

## Commands

### Fetch the last N messages from a channel

```bash
CHANNEL_ID="123456789012345678"      # paste from Discord (Copy ID)
LIMIT=50                              # max 100 per call
curl -fsSL "https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=${LIMIT}" \
  -H "Authorization: Bot ${BITTENSOR_DISCORD_BOT_TOKEN}" \
  -H "User-Agent: OpenClaw (https://openclaw.ai, 1.0)" \
  | jq '.[] | {ts: .timestamp, author: .author.username, content: .content, attachments: (.attachments | length), reactions: ([.reactions[]?.count] // [] | add // 0)}'
```

### Summary view (last hour, last day)

```bash
CHANNEL_ID="..."
SINCE_HOURS=24
curl -fsSL "https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=100" \
  -H "Authorization: Bot ${BITTENSOR_DISCORD_BOT_TOKEN}" \
  | jq --arg cutoff "$(date -u -d "${SINCE_HOURS} hours ago" +%FT%TZ)" '
      [ .[] | select(.timestamp > $cutoff) | {ts: .timestamp, who: .author.username, msg: .content[:200]} ]
      | sort_by(.ts)
    '
```

### Search across multiple channels (foreach loop)

```bash
TOPIC="$1"  # e.g. "subnet 5" or "halving"
for CHANNEL in 111... 222... 333...; do
  echo "=== channel $CHANNEL ==="
  curl -fsSL "https://discord.com/api/v10/channels/${CHANNEL}/messages?limit=50" \
    -H "Authorization: Bot ${BITTENSOR_DISCORD_BOT_TOKEN}" \
    | jq --arg q "$TOPIC" '
        [ .[] | select(.content | ascii_downcase | contains($q | ascii_downcase)) | {ts: .timestamp, who: .author.username, msg: .content[:300]} ]
      '
done
```

### Find a channel ID by name (lists all channels in a guild)

```bash
GUILD_ID="..."  # Bittensor guild ID (right-click server icon → Copy ID after enabling Dev Mode)
curl -fsSL "https://discord.com/api/v10/guilds/${GUILD_ID}/channels" \
  -H "Authorization: Bot ${BITTENSOR_DISCORD_BOT_TOKEN}" \
  | jq '.[] | select(.type == 0) | {id, name}'   # type 0 = text channel
```

## Output template

When summarizing, use this structure:

```
💬 Bittensor Discord — {channel name or "across N channels"}
Window: last {N} hours (UTC)

📌 Top items
- [{author}, {timestamp}] {one-line summary of the message}
- ...

📈 Trends
- {hot topic 1}: mentioned {X} times
- {hot topic 2}: mentioned {Y} times

🚨 Notable
- {anything that looks like an announcement, breaking news, or coordinated action}

🔗 Source: #{channel-name} (ID {channel-id})
```

## Notes for the agent

- **Always honor rate limits**: Discord's API caps at ~50 requests per second per token. If you get HTTP 429, back off using the `Retry-After` header.
- **Never leak the bot token in output** — it's a secret. Read it from env, don't echo it.
- **Don't quote messages verbatim if they look private/personal**. Summarize neutrally.
- **Respect ephemeral chat**: deleted/edited messages should be flagged as such; don't paraphrase deletions.
- **Cache channel IDs in your context** for the session — looking them up repeatedly wastes requests.
- **This skill is read-only**. Do not send messages, react, or modify Discord state from here.
- **If asked about a specific subnet's Discord activity**, look in `#subnet-{N}` if it exists; otherwise grep `#general`/`#announcements` for `subnet N` mentions.

## Limitations

- Bittensor has many subnet-specific Discords (some run their own servers). This skill targets the main OTF Discord by default. For subnet-N-specific Discords, the user has to give you that server's ID separately.
- If `BITTENSOR_DISCORD_BOT_TOKEN` isn't set, refuse to call the API and tell the user the setup steps above. Don't fall back to web scraping (Discord blocks bots without auth).
