---
summary: "Complete reference for CLI setup flow, auth/model setup, outputs, and internals"
read_when:
  - You need detailed behavior for openclaw onboard
  - You are debugging onboarding results or integrating onboarding clients
title: "CLI setup reference"
sidebarTitle: "CLI reference"
---

This page is the full reference for `openclaw onboard`.
For the short guide, see [Onboarding (CLI)](/start/wizard).

## What the wizard does

Local mode (default) walks you through:

- Model and auth setup (OpenAI Code subscription browser login or device pairing)
- Workspace location and bootstrap files
- Gateway settings (port, bind, auth, tailscale)
- Channels and providers (Telegram and Discord)
- Daemon install (LaunchAgent, systemd user unit, or native Windows Scheduled Task with Startup-folder fallback)
- Health check
- Skills setup

Remote mode configures this machine to connect to a gateway elsewhere.
It does not install or modify anything on the remote host.

## Local flow details

<Steps>
  <Step title="Existing config detection">
    - If `~/.openclaw/openclaw.json` exists, choose Keep, Modify, or Reset.
    - Re-running the wizard does not wipe anything unless you explicitly choose Reset (or pass `--reset`).
    - CLI `--reset` defaults to `config+creds+sessions`; use `--reset-scope full` to also remove workspace.
    - If config is invalid or contains legacy keys, the wizard stops and asks you to run `openclaw doctor` before continuing.
    - Reset uses `trash` and offers scopes:
      - Config only
      - Config + credentials + sessions
      - Full reset (also removes workspace)

  </Step>
  <Step title="Model and auth">
    - Full option matrix is in [Auth and model options](#auth-and-model-options).

  </Step>
  <Step title="Workspace">
    - Default `~/.openclaw/workspace` (configurable).
    - Seeds workspace files needed for first-run bootstrap ritual.
    - Workspace layout: [Agent workspace](/concepts/agent-workspace).

  </Step>
  <Step title="Gateway">
    - Prompts for port, bind, auth mode, and tailscale exposure.
    - Recommended: keep token auth enabled even for loopback so local WS clients must authenticate.
    - In token mode, interactive setup offers:
      - **Generate/store plaintext token** (default)
      - **Use SecretRef** (opt-in)
    - In password mode, interactive setup also supports plaintext or SecretRef storage.
    - Non-interactive token SecretRef path: `--gateway-token-ref-env <ENV_VAR>`.
      - Requires a non-empty env var in the onboarding process environment.
      - Cannot be combined with `--gateway-token`.
    - Disable auth only if you fully trust every local process.
    - Non-loopback binds still require auth.

  </Step>
  <Step title="Channels">
    - [Telegram](/channels/telegram): bot token
    - [Discord](/channels/discord): bot token
    - DM security: default is pairing. First DM sends a code; approve via
      `openclaw pairing approve <channel> <code>` or use allowlists.
  </Step>
  <Step title="Daemon install">
    - macOS: LaunchAgent
      - Requires logged-in user session; for headless, use a custom LaunchDaemon (not shipped).
    - Linux and Windows via WSL2: systemd user unit
      - Wizard attempts `loginctl enable-linger <user>` so gateway stays up after logout.
      - May prompt for sudo (writes `/var/lib/systemd/linger`); it tries without sudo first.
    - Native Windows: Scheduled Task first
      - If task creation is denied, OpenClaw falls back to a per-user Startup-folder login item and starts the gateway immediately.
      - Scheduled Tasks remain preferred because they provide better supervisor status.
    - Runtime selection: Node (recommended). Bun is not recommended.

  </Step>
  <Step title="Health check">
    - Starts gateway (if needed) and runs `openclaw health`.
    - `openclaw status --deep` adds the live gateway health probe to status output, including channel probes when supported.

  </Step>
  <Step title="Skills">
    - Reads available skills and checks requirements.
    - Lets you choose node manager: npm, pnpm, or bun.
    - Installs optional dependencies (some use Homebrew on macOS).

  </Step>
  <Step title="Finish">
    - Summary and next steps, including iOS, Android, and macOS app options.

  </Step>
</Steps>

<Note>
If no GUI is detected, the wizard prints SSH port-forward instructions for the Control UI instead of opening a browser.
If Control UI assets are missing, the wizard attempts to build them; fallback is `pnpm ui:build` (auto-installs UI deps).
</Note>

## Remote mode details

Remote mode configures this machine to connect to a gateway elsewhere.

<Info>
Remote mode does not install or modify anything on the remote host.
</Info>

What you set:

- Remote gateway URL (`ws://...`)
- Token if remote gateway auth is required (recommended)

<Note>
- If gateway is loopback-only, use SSH tunneling or a tailnet.
- Discovery hints:
  - macOS: Bonjour (`dns-sd`)
  - Linux: Avahi (`avahi-browse`)

</Note>

## Auth and model options

<AccordionGroup>
  <Accordion title="OpenAI Code subscription (OAuth)">
    Browser flow; paste `code#state`.

    Sets `agents.defaults.model` to `openai/gpt-5.5` through the Codex runtime when model is unset or already OpenAI-family.

  </Accordion>
  <Accordion title="OpenAI Code subscription (device pairing)">
    Browser pairing flow with a short-lived device code.

    Sets `agents.defaults.model` to `openai/gpt-5.5` through the Codex runtime when model is unset or already OpenAI-family.

  </Accordion>
  <Accordion title="Unsupported auth choices">
    Onboarding rejects API-key, token-provider, custom-provider, and unsupported provider flags. Use `--auth-choice openai-codex`, `--auth-choice openai-codex-device-code`, or `--auth-choice skip`.
  </Accordion>
  <Accordion title="Skip">
    Leaves auth unconfigured.
  </Accordion>
</AccordionGroup>

Model behavior:

- Pick default model from detected options, or enter provider and model manually.
- Custom-provider onboarding infers image support for common model IDs and asks only when the model name is unknown.
- When onboarding starts from a provider auth choice, the model picker prefers
  that provider automatically. For Volcengine and BytePlus, the same preference
  also matches their coding-plan variants (`volcengine-plan/*`,
  `byteplus-plan/*`).
- If that preferred-provider filter would be empty, the picker falls back to
  the full supported catalog instead of showing no models.
- Wizard runs a model check and warns if the configured model is unknown or missing auth.

Credential and profile paths:

- Auth profiles (API keys + OAuth): `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- Legacy OAuth import: `~/.openclaw/credentials/oauth.json`

Credential storage mode:

- Default onboarding behavior persists API keys as plaintext values in auth profiles.
- Onboarding model auth is scoped to OpenAI subscription login. API-key, token-provider, custom-provider, and unsupported provider flags are rejected.
- Gateway auth credentials support plaintext and SecretRef choices in interactive setup:
  - Token mode: **Generate/store plaintext token** (default) or **Use SecretRef**.
  - Password mode: plaintext or SecretRef.
- Non-interactive token SecretRef path: `--gateway-token-ref-env <ENV_VAR>`.
- Existing plaintext setups continue to work unchanged.

<Note>
Headless and server tip: complete OAuth on a machine with a browser, then copy
that agent's `auth-profiles.json` (for example
`~/.openclaw/agents/<agentId>/agent/auth-profiles.json`, or the matching
`$OPENCLAW_STATE_DIR/...` path) to the gateway host. `credentials/oauth.json`
is only a legacy import source.
</Note>

## Outputs and internals

Typical fields in `~/.openclaw/openclaw.json`:

- `agents.defaults.workspace`
- `agents.defaults.skipBootstrap` when `--skip-bootstrap` is passed
- `agents.defaults.model`
- `tools.profile` (local onboarding defaults to `"coding"` when unset; existing explicit values are preserved)
- `gateway.*` (mode, bind, auth, tailscale)
- `session.dmScope` (local onboarding defaults this to `per-channel-peer` when unset; existing explicit values are preserved)
- `channels.telegram.botToken`, `channels.discord.token`
- Discord channel allowlists when you opt in during prompts (names resolve to IDs when possible)
- `skills.install.nodeManager`
  - The `setup --node-manager` flag accepts `npm`, `pnpm`, or `bun`.
  - Manual config can still set `skills.install.nodeManager: "yarn"` later.
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` writes `agents.list[]` and optional `bindings`.

Sessions are stored under `~/.openclaw/agents/<agentId>/sessions/`.

<Note>
Some channels are delivered as plugins. When selected during setup, the wizard
prompts to install the plugin (npm or local path) before channel configuration.
</Note>

Gateway wizard RPC:

- `wizard.start`
- `wizard.next`
- `wizard.cancel`
- `wizard.status`

Clients (macOS app and Control UI) can render steps without re-implementing onboarding logic.

## Related docs

- Onboarding hub: [Onboarding (CLI)](/start/wizard)
- Automation and scripts: [CLI Automation](/start/wizard-cli-automation)
- Command reference: [`openclaw onboard`](/cli/onboard)
