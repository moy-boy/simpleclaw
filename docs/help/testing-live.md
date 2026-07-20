---
summary: "Live (network-touching) tests for OpenAI subscription models and supported channels"
read_when:
  - Running live OpenAI subscription or supported-channel smokes
  - Debugging live-test credential resolution
  - Adding a new supported live test
title: "Testing: live suites"
sidebarTitle: "Live tests"
---

For quick start, QA runners, unit/integration suites, and Docker flows, see
[Testing](/help/testing). This page covers the **live** (network-touching) test
suites for the simplified OpenAI, Telegram, and Discord surface.

## Live: local smoke commands

Authenticate the OpenAI subscription profile before ad hoc live checks.

Safe media smoke:

```bash
pnpm openclaw infer tts convert --local --json \
  --text "OpenClaw live smoke." \
  --output /tmp/openclaw-live-smoke.mp3
```

Safe voice-call readiness smoke:

```bash
pnpm openclaw voicecall setup --json
pnpm openclaw voicecall smoke --to "+15555550123"
```

`voicecall smoke` is a dry run unless `--yes` is also present. Use `--yes` only
when you intentionally want to place a real notify call. For Twilio, Telnyx, and
Plivo, a successful readiness check requires a public webhook URL; local-only
loopback/private fallbacks are rejected by design.

## Live: Android node capability sweep

- Test: `src/gateway/android-node.capabilities.live.test.ts`
- Script: `pnpm android:test:integration`
- Goal: invoke **every command currently advertised** by a connected Android node and assert command contract behavior.
- Scope:
  - Preconditioned/manual setup (the suite does not install/run/pair the app).
  - Command-by-command gateway `node.invoke` validation for the selected Android node.
- Required pre-setup:
  - Android app already connected + paired to the gateway.
  - App kept in foreground.
  - Permissions/capture consent granted for capabilities you expect to pass.
- Optional target overrides:
  - `OPENCLAW_ANDROID_NODE_ID` or `OPENCLAW_ANDROID_NODE_NAME`.
  - `OPENCLAW_ANDROID_GATEWAY_URL` / `OPENCLAW_ANDROID_GATEWAY_TOKEN` / `OPENCLAW_ANDROID_GATEWAY_PASSWORD`.
- Full Android setup details: Android App

## Live: model smoke (profile keys)

Live tests are split into two layers so we can isolate failures:

- "Direct model" tells us the provider/model can answer at all with the given key.
- "Gateway smoke" tells us the full gateway+agent pipeline works for that model (sessions, history, tools, sandbox policy, etc.).

### Layer 1: Direct model completion (no gateway)

- Test: `src/agents/models.profiles.live.test.ts`
- Goal:
  - Enumerate discovered models
  - Use `getApiKeyForModel` to select models you have creds for
  - Run a small completion per model (and targeted regressions where needed)
- How to enable:
  - `pnpm test:live` (or `OPENCLAW_LIVE_TEST=1` if invoking Vitest directly)
- Set `OPENCLAW_LIVE_MODELS=modern` (or `all`, alias for modern) to actually run this suite; otherwise it skips to keep `pnpm test:live` focused on gateway smoke
- How to select models:
  - `OPENCLAW_LIVE_MODELS=modern` to run the current OpenAI subscription allowlist
  - `OPENCLAW_LIVE_MODELS=all` is an alias for the modern allowlist
  - or `OPENCLAW_LIVE_MODELS="openai/gpt-5.5,openai-codex/gpt-5.5"` (comma allowlist)
  - Modern/all sweeps default to a curated high-signal cap; set `OPENCLAW_LIVE_MAX_MODELS=0` for an exhaustive modern sweep or a positive number for a smaller cap.
  - Exhaustive sweeps use `OPENCLAW_LIVE_TEST_TIMEOUT_MS` for the whole direct-model test timeout. Default: 60 minutes.
  - Direct-model probes run with 20-way parallelism by default; set `OPENCLAW_LIVE_MODEL_CONCURRENCY` to override.
- How to select providers:
  - `OPENCLAW_LIVE_PROVIDERS="openai,openai-codex"` (comma allowlist)
- Where keys come from:
  - By default: profile store and env fallbacks
  - Set `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1` to enforce **profile store** only
- Why this exists:
  - Separates "provider API is broken / key is invalid" from "gateway agent pipeline is broken"
  - Contains small, isolated regressions (example: OpenAI Responses/Codex Responses reasoning replay + tool-call flows)

### Layer 2: Gateway + dev agent smoke (what "@openclaw" actually does)

- Test: `src/gateway/gateway-models.profiles.live.test.ts`
- Goal:
  - Spin up an in-process gateway
  - Create/patch a `agent:dev:*` session (model override per run)
  - Iterate models-with-keys and assert:
    - "meaningful" response (no tools)
    - a real tool invocation works (read probe)
    - optional extra tool probes (exec+read probe)
    - OpenAI regression paths (tool-call-only → follow-up) keep working
- Probe details (so you can explain failures quickly):
  - `read` probe: the test writes a nonce file in the workspace and asks the agent to `read` it and echo the nonce back.
  - `exec+read` probe: the test asks the agent to `exec`-write a nonce into a temp file, then `read` it back.
  - image probe: the test attaches a generated PNG (cat + randomized code) and expects the model to return `cat <CODE>`.
  - Implementation reference: `src/gateway/gateway-models.profiles.live.test.ts` and `test/helpers/live-image-probe.ts`.
- How to enable:
  - `pnpm test:live` (or `OPENCLAW_LIVE_TEST=1` if invoking Vitest directly)
- How to select models:
  - Default: OpenAI subscription allowlist (OpenAI + Codex models)
  - `OPENCLAW_LIVE_GATEWAY_MODELS=all` is an alias for the modern allowlist
  - Or set `OPENCLAW_LIVE_GATEWAY_MODELS="provider/model"` (or comma list) to narrow
  - Modern/all gateway sweeps default to a curated high-signal cap; set `OPENCLAW_LIVE_GATEWAY_MAX_MODELS=0` for an exhaustive modern sweep or a positive number for a smaller cap.
- How to select providers:
  - `OPENCLAW_LIVE_GATEWAY_PROVIDERS="openai,openai-codex"` (comma allowlist)
- Tool + image probes are always on in this live test:
  - `read` probe + `exec+read` probe (tool stress)
  - image probe runs when the model advertises image input support
  - Flow (high level):
    - Test generates a tiny PNG with "CAT" + random code (`test/helpers/live-image-probe.ts`)
    - Sends it via `agent` `attachments: [{ mimeType: "image/png", content: "<base64>" }]`
    - Gateway parses attachments into `images[]` (`src/gateway/server-methods/agent.ts` + `src/gateway/chat-attachments.ts`)
    - Embedded agent forwards a multimodal user message to the model
    - Assertion: reply contains `cat` + the code (OCR tolerance: minor mistakes allowed)

<Tip>
To see what you can test on your machine (and the exact `provider/model` ids), run:

```bash
openclaw models list
openclaw models list --json
```

</Tip>

## Live: Codex harness smoke

- Test: `src/gateway/gateway-cli-backend.live.test.ts`
- Goal: validate the Gateway + agent pipeline through the supported Codex/OpenAI subscription path without touching your default config.
- Backend-specific smoke defaults live with the owning extension metadata.
- Enable:
  - `pnpm test:live` (or `OPENCLAW_LIVE_TEST=1` if invoking Vitest directly)
  - `OPENCLAW_LIVE_CLI_BACKEND=1`
- Defaults:
  - Default provider/model: `openai-codex/gpt-5.5`
  - Command/args/image behavior come from the supported Codex harness metadata.
- Overrides (optional):
  - `OPENCLAW_LIVE_CLI_BACKEND_MODEL="openai-codex/gpt-5.5"`
  - `OPENCLAW_LIVE_CLI_BACKEND_COMMAND="/full/path/to/codex"`
  - `OPENCLAW_LIVE_CLI_BACKEND_ARGS='["-p","--output-format","json"]'`
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_PROBE=1` to send a real image attachment (paths are injected into the prompt). Docker recipes default this off unless explicitly requested.
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_ARG="--image"` to pass image file paths as CLI args instead of prompt injection.
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_MODE="repeat"` (or `"list"`) to control how image args are passed when `IMAGE_ARG` is set.
  - `OPENCLAW_LIVE_CLI_BACKEND_RESUME_PROBE=1` to send a second turn and validate resume flow.
  - `OPENCLAW_LIVE_CLI_BACKEND_MODEL_SWITCH_PROBE=1` to opt into same-session model-switch continuity when the selected model supports a switch target. Docker recipes default this off for aggregate reliability.
  - `OPENCLAW_LIVE_CLI_BACKEND_MCP_PROBE=1` to opt into the MCP/tool loopback probe. Docker recipes default this off unless explicitly requested.

Example:

```bash
  OPENCLAW_LIVE_CLI_BACKEND=1 \
  OPENCLAW_LIVE_CLI_BACKEND_MODEL="openai-codex/gpt-5.5" \
  pnpm test:live src/gateway/gateway-cli-backend.live.test.ts
```

Docker recipe:

```bash
pnpm test:docker:live-cli-backend
```

Single-provider Docker recipes:

The simplified OpenAI subscription surface validates the Codex app-server
harness instead of external CLI backends.

Notes:

- Keep external CLI-backend lanes out of simplified validation unless you are
  deliberately testing an unsupported plugin in a full-surface checkout.
- Use the Codex harness smoke below for the supported subscription path.

## Live: APNs HTTP/2 proxy reachability

- Test: `src/infra/push-apns-http2.live.test.ts`
- Goal: tunnel through a local HTTP CONNECT proxy to Apple's sandbox APNs endpoint, send the APNs HTTP/2 validation request, and assert Apple's real `403 InvalidProviderToken` response comes back through the proxy path.
- Enable:
  - `OPENCLAW_LIVE_TEST=1 OPENCLAW_LIVE_APNS_REACHABILITY=1 pnpm test:live src/infra/push-apns-http2.live.test.ts`
- Optional timeout:
  - `OPENCLAW_LIVE_APNS_TIMEOUT_MS=30000`

## Live: Codex app-server harness smoke

- Goal: validate the plugin-owned Codex harness through the normal gateway
  `agent` method:
  - load the bundled `codex` plugin
  - select `openai/gpt-5.5`, which routes OpenAI agent turns through Codex by default
  - send a first gateway agent turn to `openai/gpt-5.5` with the Codex harness selected
  - send a second turn to the same OpenClaw session and verify the app-server
    thread can resume
  - run `/codex status` and `/codex models` through the same gateway command
    path
  - optionally run two Guardian-reviewed escalated shell probes: one benign
    command that should be approved and one fake-secret upload that should be
    denied so the agent asks back
- Test: `src/gateway/gateway-codex-harness.live.test.ts`
- Enable: `OPENCLAW_LIVE_CODEX_HARNESS=1`
- Default model: `openai/gpt-5.5`
- Optional image probe: `OPENCLAW_LIVE_CODEX_HARNESS_IMAGE_PROBE=1`
- Optional MCP/tool probe: `OPENCLAW_LIVE_CODEX_HARNESS_MCP_PROBE=1`
- Optional Guardian probe: `OPENCLAW_LIVE_CODEX_HARNESS_GUARDIAN_PROBE=1`
- The smoke forces provider/model `agentRuntime.id: "codex"` so a broken Codex
  harness cannot pass by silently falling back to PI.
- Auth: Codex app-server auth from the local Codex subscription login. Docker
  smokes can also provide `OPENAI_API_KEY` for non-Codex probes when applicable,
  plus optional copied `~/.codex/auth.json` and `~/.codex/config.toml`.

Local recipe:

```bash
OPENCLAW_LIVE_CODEX_HARNESS=1 \
  OPENCLAW_LIVE_CODEX_HARNESS_IMAGE_PROBE=1 \
  OPENCLAW_LIVE_CODEX_HARNESS_MCP_PROBE=1 \
  OPENCLAW_LIVE_CODEX_HARNESS_GUARDIAN_PROBE=1 \
  OPENCLAW_LIVE_CODEX_HARNESS_MODEL=openai/gpt-5.5 \
  pnpm test:live -- src/gateway/gateway-codex-harness.live.test.ts
```

Docker recipe:

```bash
pnpm test:docker:live-codex-harness
```

Docker notes:

- The Docker runner lives at `scripts/test-live-codex-harness-docker.sh`.
- It passes `OPENAI_API_KEY`, copies Codex CLI auth files when present, installs
  `@openai/codex` into a writable mounted npm
  prefix, stages the source tree, then runs only the Codex-harness live test.
- Docker enables the image, MCP/tool, and Guardian probes by default. Set
  `OPENCLAW_LIVE_CODEX_HARNESS_IMAGE_PROBE=0` or
  `OPENCLAW_LIVE_CODEX_HARNESS_MCP_PROBE=0` or
  `OPENCLAW_LIVE_CODEX_HARNESS_GUARDIAN_PROBE=0` when you need a narrower debug
  run.
- Docker uses the same explicit Codex runtime config, so legacy aliases or PI
  fallback cannot hide a Codex harness regression.

### Recommended live recipes

Narrow, explicit allowlists are fastest and least flaky:

- Single model, direct (no gateway):
  - `OPENCLAW_LIVE_MODELS="openai/gpt-5.5" pnpm test:live src/agents/models.profiles.live.test.ts`

- Single model, gateway smoke:
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.5" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- Tool calling across supported OpenAI routes:
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.5,openai-codex/gpt-5.5" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

## Live: model matrix (what we cover)

There is no fixed "CI model list" (live is opt-in), but these are the **recommended** models to cover regularly on a dev machine with keys.

### Modern smoke set (tool calling + image)

This is the supported smoke run we expect to keep working:

- OpenAI subscription: `openai/gpt-5.5`
- OpenAI Codex auth compatibility: `openai-codex/gpt-5.5`

Run gateway smoke with tools + image:
`OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.5,openai-codex/gpt-5.5" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

### Baseline: tool calling (Read + optional Exec)

Pick at least one supported route:

- OpenAI subscription: `openai/gpt-5.5` and `openai/gpt-5.4`
- OpenAI Codex auth route: `openai-codex/gpt-5.5` only when testing legacy
  auth/profile migration behavior

### Vision: image send (attachment → multimodal message)

Include at least one image-capable OpenAI model in `OPENCLAW_LIVE_GATEWAY_MODELS`
to exercise the image probe.

<Tip>
Do not hardcode "all models" in docs. The simplified live matrix should stay on
OpenAI subscription-backed model refs.
</Tip>

## Credentials (never commit)

Live tests discover credentials the same way the CLI does. Practical implications:

- If the CLI works, live tests should find the same keys.
- If a live test says "no creds", debug the same way you'd debug `openclaw models list` / model selection.

- Per-agent auth profiles: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` (this is what "profile keys" means in the live tests)
- Config: `~/.openclaw/openclaw.json` (or `OPENCLAW_CONFIG_PATH`)
- Legacy state dir: `~/.openclaw/credentials/` (copied into the staged live home when present, but not the main profile-key store)
- Live local runs copy the active config, per-agent `auth-profiles.json` files, legacy `credentials/`, and supported external CLI auth dirs into a temp test home by default; staged live homes skip `workspace/` and `sandboxes/`, and `agents.*.workspace` / `agentDir` path overrides are stripped so probes stay off your real host workspace.

If you want to rely on env keys, export them before local tests or use the
Docker runners below with an explicit `OPENCLAW_PROFILE_FILE`.

## Deepgram live (audio transcription)

- Test: `extensions/deepgram/audio.live.test.ts`
- Enable: `DEEPGRAM_API_KEY=... DEEPGRAM_LIVE_TEST=1 pnpm test:live extensions/deepgram/audio.live.test.ts`

## BytePlus coding plan live

- Test: `extensions/byteplus/live.test.ts`
- Enable: `BYTEPLUS_API_KEY=... BYTEPLUS_LIVE_TEST=1 pnpm test:live extensions/byteplus/live.test.ts`
- Optional model override: `BYTEPLUS_CODING_MODEL=ark-code-latest`

## Image generation live

- Test: `test/image-generation.runtime.live.test.ts`
- Command: `pnpm test:live test/image-generation.runtime.live.test.ts`
- Harness: `pnpm test:live:media image`
- Scope:
  - Enumerates every registered image-generation provider plugin
  - Uses already-exported provider env vars before probing
  - Uses live/env API keys ahead of stored auth profiles by default, so stale test keys in `auth-profiles.json` do not mask real shell credentials
  - Skips providers with no usable auth/profile/model
  - Runs each configured provider through the shared image-generation runtime:
    - `<provider>:generate`
    - `<provider>:edit` when the provider declares edit support
- Current simplified provider coverage:
  - `openai`
- Optional narrowing:
  - `OPENCLAW_LIVE_IMAGE_GENERATION_PROVIDERS="openai"`
  - `OPENCLAW_LIVE_IMAGE_GENERATION_MODELS="openai/gpt-image-2"`
- Optional auth behavior:
  - `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1` to force profile-store auth and ignore env-only overrides

For the shipped CLI path, add an `infer` smoke after the provider/runtime live
test passes:

```bash
OPENCLAW_LIVE_TEST=1 OPENCLAW_LIVE_INFER_CLI_TEST=1 pnpm test:live -- test/image-generation.infer-cli.live.test.ts
openclaw infer image providers --json
openclaw infer image generate \
  --model openai/gpt-image-2 \
  --prompt "Minimal flat test image: one blue square on a white background, no text." \
  --output ./openclaw-infer-image-smoke.png \
  --json
```

This covers CLI argument parsing, config/default-agent resolution, bundled
plugin activation, the shared image-generation runtime, and the live provider
request. Plugin dependencies are expected to be present before runtime load.

## Video generation live

- Test: `extensions/video-generation-providers.live.test.ts`
- Enable: `OPENCLAW_LIVE_TEST=1 pnpm test:live -- extensions/video-generation-providers.live.test.ts`
- Harness: `pnpm test:live:media video`
- Scope:
  - Exercises the shared bundled video-generation provider path
  - Defaults to the supported OpenAI provider path
  - Uses already-exported OpenAI env vars before probing
  - Uses live/env API keys ahead of stored auth profiles by default, so stale test keys in `auth-profiles.json` do not mask real shell credentials
  - Skips providers with no usable auth/profile/model
  - Runs only `generate` by default
  - Set `OPENCLAW_LIVE_VIDEO_GENERATION_FULL_MODES=1` to also run declared transform modes when available:
    - `imageToVideo` when the provider declares `capabilities.imageToVideo.enabled` and the selected provider/model accepts buffer-backed local image input in the shared sweep
    - `videoToVideo` when the provider declares `capabilities.videoToVideo.enabled` and the selected provider/model accepts buffer-backed local video input in the shared sweep
- Optional narrowing:
  - `OPENCLAW_LIVE_VIDEO_GENERATION_PROVIDERS="openai"`
  - `OPENCLAW_LIVE_VIDEO_GENERATION_MODELS="openai/sora-2"`
  - `OPENCLAW_LIVE_VIDEO_GENERATION_TIMEOUT_MS=60000` to reduce each provider operation cap for an aggressive smoke run
- Optional auth behavior:
  - `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1` to force profile-store auth and ignore env-only overrides

## Media live harness

- Command: `pnpm test:live:media`
- Purpose:
  - Runs the shared image, music, and video live suites through one repo-native entrypoint
  - Uses already-exported provider env vars
  - Auto-narrows each suite to providers that currently have usable auth by default
  - Reuses `scripts/test-live.mjs`, so heartbeat and quiet-mode behavior stay consistent
- Examples:
  - `pnpm test:live:media`
  - `pnpm test:live:media image video --providers openai,google,minimax`
  - `pnpm test:live:media video --video-providers openai,runway --all-providers`
  - `pnpm test:live:media music --quiet`

## Related

- [Testing](/help/testing) - unit, integration, QA, and Docker suites
