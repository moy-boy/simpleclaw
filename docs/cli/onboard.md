---
summary: "CLI reference for `openclaw onboard` (interactive onboarding)"
read_when:
  - You want guided setup for gateway, workspace, auth, channels, and skills
title: "Onboard"
---

# `openclaw onboard`

Full guided onboarding for local or remote Gateway setup. Use this when you want OpenClaw to walk through model auth, workspace, gateway, channels, skills, and health in one flow.

## Related guides

<CardGroup cols={2}>
  <Card title="CLI onboarding hub" href="/start/wizard" icon="rocket">
    Walkthrough of the interactive CLI flow.
  </Card>
  <Card title="Onboarding overview" href="/start/onboarding-overview" icon="map">
    How OpenClaw onboarding fits together.
  </Card>
  <Card title="CLI setup reference" href="/start/wizard-cli-reference" icon="book">
    Outputs, internals, and per-step behavior.
  </Card>
  <Card title="CLI automation" href="/start/wizard-cli-automation" icon="terminal">
    Non-interactive flags and scripted setups.
  </Card>
  <Card title="macOS app onboarding" href="/start/onboarding" icon="apple">
    Onboarding flow for the macOS menu bar app.
  </Card>
</CardGroup>

## Examples

```bash
openclaw onboard
openclaw onboard --modern
openclaw onboard --flow quickstart
openclaw onboard --flow manual
openclaw onboard --flow import
openclaw onboard --import-from hermes --import-source ~/.hermes
openclaw onboard --skip-bootstrap
openclaw onboard --mode remote --remote-url wss://gateway-host:18789
openclaw onboard --non-interactive --auth-choice openai-codex-device-code --accept-risk
```

`--flow import` uses plugin-owned migration providers such as Hermes. It only runs against a fresh OpenClaw setup; if existing config, credentials, sessions, or workspace memory/identity files are present, reset or choose a fresh setup before importing.

`--modern` starts the Crestodian conversational onboarding preview. Without
`--modern`, `openclaw onboard` keeps the classic onboarding flow.

On a fresh install where the active config file is missing or has no authored
settings (empty or metadata-only), bare `openclaw` also starts the classic
onboarding flow. Once a config file has authored settings, bare `openclaw`
opens Crestodian instead.

Plaintext `ws://` is accepted for loopback, private IP literals, `.local`, and
Tailnet `*.ts.net` gateway URLs. For other trusted private-DNS names, set
`OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1` in the onboarding process environment.

## Locale

Interactive onboarding uses the CLI wizard locale for fixed setup copy. Resolve
order is:

1. `OPENCLAW_LOCALE`
2. `LC_ALL`
3. `LC_MESSAGES`
4. `LANG`
5. English fallback

Supported wizard locales are `en`, `zh-CN`, and `zh-TW`. Locale values may use
underscore or POSIX suffix forms such as `zh_CN.UTF-8`. Product names, command
names, config keys, URLs, provider IDs, model IDs, and plugin/channel labels
remain literal.

Example:

```bash
OPENCLAW_LOCALE=zh-CN openclaw onboard
```

## Supported setup surface

This simplified OpenClaw setup exposes:

- message channels: Telegram and Discord
- model auth: OpenAI subscription login

Use browser login interactively:

```bash
openclaw onboard
```

Use device pairing for non-interactive or headless setup:

```bash
openclaw onboard --non-interactive \
  --auth-choice openai-codex-device-code \
  --accept-risk
```

Onboarding rejects API-key, token-provider, custom-provider, and unsupported provider flags. Use `--auth-choice openai-codex`, `--auth-choice openai-codex-device-code`, or `--auth-choice skip`.

Gateway token options in non-interactive mode:

- `--gateway-auth token --gateway-token <token>` stores a plaintext token.
- `--gateway-auth token --gateway-token-ref-env <name>` stores `gateway.auth.token` as an env SecretRef.
- `--gateway-token` and `--gateway-token-ref-env` are mutually exclusive.
- `--gateway-token-ref-env` requires a non-empty env var in the onboarding process environment.
- With `--install-daemon`, when token auth requires a token, SecretRef-managed gateway tokens are validated but not persisted as resolved plaintext in supervisor service environment metadata.
- With `--install-daemon`, if token mode requires a token and the configured token SecretRef is unresolved, onboarding fails closed with remediation guidance.
- With `--install-daemon`, if both `gateway.auth.token` and `gateway.auth.password` are configured and `gateway.auth.mode` is unset, onboarding blocks install until mode is set explicitly.
- Local onboarding writes `gateway.mode="local"` into the config. If a later config file is missing `gateway.mode`, treat that as config damage or an incomplete manual edit, not as a valid local-mode shortcut.
- Local onboarding installs selected downloadable plugins when the chosen setup path requires them.
- Remote onboarding only writes connection info for the remote Gateway and does not install local plugin packages.
- `--allow-unconfigured` is a separate gateway runtime escape hatch. It does not mean onboarding may omit `gateway.mode`.

Example:

```bash
export OPENCLAW_GATEWAY_TOKEN="your-token"
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice skip \
  --gateway-auth token \
  --gateway-token-ref-env OPENCLAW_GATEWAY_TOKEN \
  --accept-risk
```

Non-interactive local gateway health:

- Unless you pass `--skip-health`, onboarding waits for a reachable local gateway before it exits successfully.
- `--install-daemon` starts the managed gateway install path first. Without it, you must already have a local gateway running, for example `openclaw gateway run`.
- If you only want config/workspace/bootstrap writes in automation, use `--skip-health`.
- If you manage workspace files yourself, pass `--skip-bootstrap` to set `agents.defaults.skipBootstrap: true` and skip creating `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, and `BOOTSTRAP.md`.
- On native Windows, `--install-daemon` tries Scheduled Tasks first and falls back to a per-user Startup-folder login item if task creation is denied.

Interactive onboarding behavior with reference mode:

- Choose **Use secret reference** when prompted.
- Then choose either:
  - Environment variable
  - Configured secret provider (`file` or `exec`)
- Onboarding performs a fast preflight validation before saving the ref.
  - If validation fails, onboarding shows the error and lets you retry.

## Flow notes

<AccordionGroup>
  <Accordion title="Flow types">
    - `quickstart`: minimal prompts, auto-generates a gateway token.
    - `manual`: full prompts for port, bind, and auth (alias of `advanced`).
    - `import`: runs a detected migration provider, previews the plan, then applies after confirmation.

  </Accordion>
  <Accordion title="Provider prefiltering">
    OpenAI subscription login prefilters the default-model and allowlist pickers to the OpenAI subscription provider.

    If the preferred-provider filter yields no loaded models yet, onboarding falls back to the unfiltered catalog instead of leaving the picker empty.

  </Accordion>
  <Accordion title="Web-search follow-ups">
    Web-search setup is separate from model auth. Use `openclaw configure --section web` after onboarding if you need web-search credentials.

  </Accordion>
  <Accordion title="Other behaviors">
    - Local onboarding DM scope behavior: [CLI setup reference](/start/wizard-cli-reference#outputs-and-internals).
    - Fastest first chat: `openclaw dashboard` (Control UI, no channel setup).

  </Accordion>
</AccordionGroup>

## Common follow-up commands

```bash
openclaw channels add
openclaw configure
openclaw agents add <name>
```

Use `openclaw setup` instead when you only need the baseline config/workspace. Use `openclaw configure` later for targeted changes and `openclaw channels add` for channel-only setup.

<Note>
`--json` does not imply non-interactive mode. Use `--non-interactive` for scripts.
</Note>
