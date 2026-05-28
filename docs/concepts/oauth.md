---
summary: "OpenAI subscription OAuth in OpenClaw"
read_when:
  - You want to understand OpenAI subscription auth storage
  - You hit OpenAI Codex OAuth or device-code login issues
  - You want multiple OpenAI accounts or profile routing
title: "OAuth"
---

OpenClaw's simplified OAuth surface is OpenAI subscription auth. The provider
auth profile is `openai-codex`, while agent model refs stay in the
`openai/<model>` form.

Use the onboarding wizard for the normal path:

```bash
openclaw onboard --auth-choice openai-codex
```

For remote or headless hosts, use device-code login:

```bash
openclaw onboard --auth-choice openai-codex-device-code
```

## Token storage

OAuth profiles live in the selected agent auth store:

- `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- legacy import-only file: `~/.openclaw/credentials/oauth.json`

Both locations respect `$OPENCLAW_STATE_DIR` when a state-dir override is set.
Static secret refs and runtime activation behavior are covered in
[Secrets Management](/gateway/secrets).

OpenClaw treats `auth-profiles.json` as the token sink. Runtime reads from the
agent auth store, refreshes expired tokens under a file lock, and keeps multiple
OpenAI profiles separate by profile id.

## OpenAI Codex flow

OpenAI Codex OAuth is supported for OpenClaw workflows. The browser-login flow:

1. Generates a PKCE verifier/challenge and random `state`.
2. Opens the OpenAI authorization URL.
3. Captures the local callback when possible.
4. Falls back to pasted redirect/code handling on remote hosts.
5. Stores access, refresh, expiry, and account metadata in the auth profile.

Device-code login uses the same profile store after the user authorizes the
code in a browser.

## Refresh and expiry

Profiles store an `expires` timestamp.

- If the access token is still valid, runtime uses it directly.
- If it expired, runtime refreshes it and writes the updated credential back to
  the owning agent store.
- If a secondary agent inherits a default-agent profile, refresh writes back to
  the default agent store rather than copying refresh tokens.

Use `openclaw models status --probe` when you need a live auth check.

## Multiple accounts

For isolated personal/work accounts, prefer separate agents:

```bash
openclaw agents add work
openclaw agents add personal
openclaw models auth login --provider openai --agent work
openclaw models auth login --provider openai --agent personal
```

Advanced single-agent setups can keep multiple OpenAI profile ids and select
them with auth order or a session model override.

Useful commands:

```bash
openclaw models auth list --provider openai
openclaw models auth order get --provider openai
openclaw models auth order set --provider openai openai-codex:default
```

## Related

- [Authentication](/gateway/authentication)
- [OpenAI provider](/providers/openai)
- [Models CLI](/cli/models)
- [Configuration reference](/gateway/configuration-reference#auth-storage)
