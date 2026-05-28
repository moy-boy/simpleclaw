---
summary: "OpenAI subscription model authentication"
read_when:
  - Debugging OpenAI subscription auth or OAuth expiry
  - Documenting OpenAI Codex auth profile storage
title: "Authentication"
---

<Note>
This page covers **model provider authentication** for the simplified OpenClaw
surface. Gateway connection authentication is separate; see
[Configuration](/gateway/configuration) and
[Trusted Proxy Auth](/gateway/trusted-proxy-auth).
</Note>

OpenClaw supports OpenAI subscription-backed model auth. The auth profile
provider is `openai-codex`; users configure agent model refs as `openai/<model>`.

## Recommended setup

For an interactive host:

```bash
openclaw onboard --auth-choice openai-codex
openclaw models status
```

For a remote or headless host:

```bash
openclaw onboard --auth-choice openai-codex-device-code
openclaw models status
```

You can also run auth directly:

```bash
openclaw models auth login --provider openai --set-default
```

`openclaw models auth add` is an interactive shortcut for the same OpenAI
subscription login flow.

## Auth profiles

`auth-profiles.json` stores credentials only. A typical OpenAI subscription
profile is stored under the selected agent:

```json
{
  "version": 1,
  "profiles": {
    "openai-codex:default": {
      "type": "oauth",
      "provider": "openai-codex"
    }
  }
}
```

Runtime reads the selected profile, refreshes expired tokens under a file lock,
and keeps token material out of CLI output.

## Status and probes

Automation-friendly status:

```bash
openclaw models status --check
```

Live auth probe:

```bash
openclaw models status --probe
```

Probe status buckets include:

- `ok`
- `auth`
- `rate_limit`
- `billing`
- `timeout`
- `format`
- `unknown`
- `no_model`

Probe rows can come from stored auth profiles or configured provider metadata.
If explicit `auth.order.<provider>` omits a stored profile, probe reports
`excluded_by_auth_order` for that profile instead of trying it.

## Auth order

Set an explicit OpenAI auth profile order for an agent:

```bash
openclaw models auth order get --provider openai
openclaw models auth order set --provider openai openai-codex:default
openclaw models auth order clear --provider openai
```

Use `--agent <id>` to target a specific configured agent.

If you change auth order or profile pinning for a chat that is already running,
send `/new` or `/reset` in that chat to start a fresh session. Existing
sessions can keep their current model/profile selection until reset.

## Troubleshooting

### "No credentials found"

Run the OpenAI subscription login flow on the gateway host, then re-check:

```bash
openclaw models auth login --provider openai
openclaw models status
```

### Token expiring or expired

Run `openclaw models status --probe` to confirm the failing profile, then rerun
OpenAI subscription login. If the session was already active, start a fresh chat
session after re-authentication.

## Related

- [OAuth](/concepts/oauth)
- [OpenAI provider](/providers/openai)
- [Secrets management](/gateway/secrets)
- [Remote access](/gateway/remote)
