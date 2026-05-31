---
name: bittensor-subnet
description: "Look up a Bittensor subnet by netuid and produce a full briefing: what it does, key on-chain stats (emission, registration cost, age, burn, top miners/validators), recent updates, emission strategy, and free study materials."
homepage: https://taostats.io
metadata:
  {
    "openclaw":
      {
        "emoji": "🧠",
        "requires": { "bins": ["curl", "jq"] },
        "install":
          [
            {
              "id": "apt",
              "kind": "apt",
              "packages": ["curl", "jq"],
              "bins": ["curl", "jq"],
              "label": "Install curl + jq (apt)",
            },
            {
              "id": "brew",
              "kind": "brew",
              "formula": "jq",
              "bins": ["jq"],
              "label": "Install jq (brew)",
            },
          ],
      },
  }
---

# Bittensor subnet briefing

Use whenever the user asks about a specific Bittensor subnet by **netuid** (e.g. "tell me about subnet 5", "what does sn 23 do", "info on netuid 64").

Produce a structured response with **every section listed below**. If a data point is genuinely unavailable, write `n/a` for that field instead of skipping it — never omit a section.

## Trigger phrases

- "subnet N", "sn N", "netuid N", "bittensor subnet N"
- "what does subnet N do"
- "info on subnet N"
- "tell me about subnet N"

## Data sources (free, no API key needed for most)

| Source                    | Best for                                                                         | How                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **taostats.io** (web)     | All on-chain stats: emission, burn, reg cost, age, validator/miner counts, owner | `curl -fsSL "https://taostats.io/subnets/{N}/"` then parse                                                      |
| **api.taostats.io**       | Same as above, JSON                                                              | `curl -fsSL "https://api.taostats.io/api/subnet/latest/v1?netuid={N}"` (best-effort — free tier may rate-limit) |
| **taoapp.io**             | Quick stats + leaderboards                                                       | `curl -fsSL "https://www.taoapp.io/subnet/{N}"`                                                                 |
| **bittensor.com/subnets** | Official catalog + descriptions                                                  | `curl -fsSL "https://bittensor.com/subnets/{N}"`                                                                |
| **GitHub**                | Subnet codebase, README, technical detail                                        | Search for `bittensor subnet {N}` or look up the owner's repo from taostats                                     |
| **docs.bittensor.com**    | Emission math, reg strategy, runtime concepts                                    | `curl -fsSL "https://docs.bittensor.com/..."`                                                                   |

If `curl` HTML responses are heavy, pipe through a text extractor or grep for the relevant blocks. Example:

```bash
curl -fsSL "https://taostats.io/subnets/5/" | sed 's/<[^>]*>//g' | tr -s ' \n' | head -200
```

## Output template (always use this exact structure)

```
🧠 Subnet {N} — {Name}

1. WHAT IT DOES
- Main idea: {one-line summary}
- Detailed: {2-4 sentences explaining the subnet's task, validators, miners, incentive model}

2. CORE INFO
- Netuid: {N}
- Name: {name}
- Owner: {ss58 address / org}
- Registered: {date or block}
- Subnet description / main task: {1-2 sentences}
- Daily emission: {X TAO}
- Registration cost (current): {X TAO}
- Incentive (alpha): {value}
- Burn rate: {value}
- Validator stake: {X TAO}
- Top miners (top 3 UIDs): {uid: stake/incentive}
- Top validators (top 3 UIDs): {uid: stake/incentive}

3. KEY LINKS
- TaoStats: https://taostats.io/subnets/{N}
- TaoApp: https://www.taoapp.io/subnet/{N}
- Official site: {if available}
- GitHub: {repo link}
- Docs/README: {link}
- Twitter/X: {if available}

4. RECENT DISCORD ACTIVITY
- For chat activity, run the `bittensor-discord` skill separately.
- This skill does **not** pull Discord — the user explicitly asked to keep that surface separate.

5. EMISSION STRATEGY (how to earn from this subnet)
- {validator strategy: required min stake, how to register, hardware needed}
- {miner strategy: model/code to run, expected ROI given current emission}
- {one risk to flag — e.g. high registration cost cycle, low alpha, rapid validator turnover}

6. FREE STUDY MATERIALS (no YouTube)
- Official subnet README + docs: {link}
- Whitepaper / blog post explaining the task: {link}
- Bittensor docs section: {link to docs.bittensor.com section that's relevant — e.g. emission, validator setup, miner setup}
- Community-written tutorials (text only, no YouTube): {link if available, prefer Mirror, GitHub READMEs, Substack, Medium}
- Subnet operator's announcement thread: {Twitter thread / forum post}
```

## Notes for the agent

- **Always verify the netuid resolves** before producing the briefing. If TaoStats returns "subnet not found", say so plainly and stop.
- **Cite freshness**: include the data timestamp from TaoStats (block height or "as of {time}").
- **Numbers in TAO**: present emission/stake in TAO with 2 decimals (e.g. `1.34 TAO/day`), not raw RAO.
- **Never invent links**. If you don't find a Twitter/site/repo, write `n/a` for that field.
- **Strategy section is opinion, mark it as such**: prefix with "From current on-chain stats, the most rational play looks like: …" and add risk caveats.
- **Study materials must be text-based**: filter out YouTube, podcasts, and live streams. Prefer GitHub READMEs, docs sites, Mirror posts, Substack articles, Medium posts.
- **Discord activity goes to the separate `bittensor-discord` skill** — do not attempt to read Discord from this skill.

## Quick lookup helpers

```bash
# One-shot summary of subnet N's main page
curl -fsSL "https://taostats.io/subnets/5/" | sed 's/<[^>]*>//g' | tr -s ' \n' | head -200

# Try the JSON API (may need API key for sustained use)
curl -fsSL "https://api.taostats.io/api/subnet/latest/v1?netuid=5" | jq .

# Bittensor's official catalog page
curl -fsSL "https://bittensor.com/subnets/5"

# Find the subnet's GitHub via search
curl -fsSL "https://api.github.com/search/repositories?q=bittensor+subnet+5+in:readme&sort=updated" | jq '.items[:3] | .[] | {full_name, html_url, description, updated_at}'
```
