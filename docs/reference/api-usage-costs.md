---
summary: "Audit what can spend money, which keys are used, and how to view usage"
read_when:
  - You want to understand which features may call paid APIs
  - You need to audit keys, costs, and usage visibility
  - You're explaining /status or /usage cost reporting
title: "API usage and costs"
---

This doc lists **features that can use the OpenAI subscription-backed model
surface** and where usage shows up. The simplified OpenClaw setup does not
configure additional hosted model/API providers by default.

## Where costs show up (chat + CLI)

**Per-session cost snapshot**

- `/status` shows the current session model, context usage, and last response tokens.
- If OpenClaw has usage metadata and local pricing for the active model,
  `/status` also shows **estimated cost** for the last reply. This can include
  explicitly priced non-API-key providers such as Bedrock `aws-sdk` models.
- If live session metadata is sparse, `/status` can recover token/cache
  counters and the active runtime model label from the latest transcript usage
  entry. Existing nonzero live values still take precedence, and prompt-sized
  transcript totals can win when stored totals are missing or smaller.

**Per-message cost footer**

- `/usage full` appends a usage footer to every reply, including **estimated cost**
  when local pricing is configured for the active model and usage metadata is
  available.
- `/usage tokens` shows tokens only when cost pricing is unavailable.

**CLI usage windows (provider quotas)**

- `openclaw status --usage` and `openclaw channels list` show provider **usage windows**
  (quota snapshots, not per-message costs).
- Human output is normalized to `X% left` across providers.
- Current usage-window provider: OpenAI Codex subscription auth.
- Usage auth comes from the stored OpenAI subscription auth profile.

See [Token use & costs](/reference/token-use) for details and examples.

## How keys are discovered

OpenClaw can pick up credentials from:

- **Auth profiles** (per-agent, stored in `auth-profiles.json`).
- **Environment variables** (for example `OPENAI_API_KEY`, when API-key-backed OpenAI access is explicitly configured).
- **Config** (`models.providers.*.apiKey`, `memorySearch.*`).
- **Skills** (`skills.entries.<name>.apiKey`) which may export keys to the skill process env.

## Features that can spend keys

### 1) Core model responses (chat + tools)

Every reply or tool call uses the current OpenAI subscription-backed model
selection. This is the primary source of usage.

See [Models](/providers/models) for pricing config and [Token use & costs](/reference/token-use) for display.

### 2) Media understanding (audio/image/video)

Inbound media can be summarized or transcribed before the reply runs. In the
simplified setup, remote media understanding uses OpenAI-backed configuration
when enabled.

See [Media understanding](/nodes/media-understanding).

### 3) Image and video generation

Shared generation capabilities can also spend provider keys:

- Image generation: OpenAI
- Video generation: OpenAI, when configured

Image generation can infer an auth-backed provider default when
`agents.defaults.imageGenerationModel` is unset. Video generation currently
requires an explicit `agents.defaults.videoGenerationModel` such as
`openai/sora-2`.

See [Image generation](/tools/image-generation) and [Models](/concepts/models).

### 4) Memory embeddings + semantic search

Semantic memory search uses OpenAI embeddings when configured for remote
provider-backed search:

- `memorySearch.provider = "openai"` → OpenAI embeddings

You can keep it local with `memorySearch.provider = "local"` (no API usage).

See [Memory](/concepts/memory).

### 5) Web search tool

`web_search` is not configured with additional hosted search providers in the
simplified setup. Installing extra search plugins can introduce separate API
costs; review that plugin's docs before enabling it.

See [Web tools](/tools/web).

### 5) Web fetch tool (Firecrawl)

`web_fetch` uses direct fetch plus local readability extraction unless you
install and configure an additional hosted fetch provider.

See [Web tools](/tools/web).

### 6) Provider usage snapshots (status/health)

Some status commands call **provider usage endpoints** to display quota windows or auth health.
These are typically low-volume calls but still hit provider APIs:

- `openclaw status --usage`
- `openclaw models status --json`

See [Models CLI](/cli/models).

### 7) Compaction safeguard summarization

The compaction safeguard can summarize session history using the **current model**, which
invokes provider APIs when it runs.

See [Session management + compaction](/reference/session-management-compaction).

### 8) Model status probes

`openclaw models status --probe` can make live OpenAI subscription-backed probe
requests when probing is enabled.

See [Models CLI](/cli/models).

### 9) Talk (speech)

Talk mode is not configured with an additional hosted speech provider in the
simplified setup.

See [Talk mode](/nodes/talk).

### 10) Skills (third-party APIs)

Skills can store `apiKey` in `skills.entries.<name>.apiKey`. If a skill uses that key for external
APIs, it can incur costs according to the skill's provider.

See [Skills](/tools/skills).

## Related

- [Token use and costs](/reference/token-use)
- [Prompt caching](/reference/prompt-caching)
- [Usage tracking](/concepts/usage-tracking)
