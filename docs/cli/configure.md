---
summary: "CLI reference for `openclaw configure` (interactive configuration prompts)"
read_when:
  - You want to tweak credentials, devices, or agent defaults interactively
title: "Configure"
---

# `openclaw configure`

Interactive prompt for targeted changes to an existing setup: OpenAI subscription login, devices, agent defaults, Gateway, Telegram/Discord channels, plugins, skills, and health checks.

Use `openclaw onboard` for the full guided first-run journey, `openclaw setup` for the baseline config/workspace only, and `openclaw channels add` when you only need channel account setup.

<Note>
The **Model** section includes a multi-select for the `agents.defaults.models` allowlist (what shows up in `/model` and the model picker). Provider-scoped setup choices merge their selected models into the existing allowlist instead of replacing unrelated providers already in the config.

Re-running OpenAI subscription auth from configure preserves an existing `agents.defaults.model.primary`, even when the auth step returns a config patch with its own recommended default model. Use `openclaw models auth login --provider openai-codex --set-default` or `openclaw models set <model>` when you intentionally want to change the default model.
</Note>

When configure starts from OpenAI subscription auth, the default-model and allowlist pickers prefer the OpenAI subscription provider automatically. If the preferred-provider filter would produce an empty list, configure falls back to the unfiltered catalog instead of showing a blank picker.

<Tip>
`openclaw config` without a subcommand opens the same wizard. Use `openclaw config get|set|unset` for non-interactive edits.
</Tip>

For web tools, `openclaw configure --section web` lets you keep the smallest
setup by leaving optional web integrations disabled, or configure them later
without changing the OpenAI subscription model setup.

Related:

- Gateway configuration reference: [Configuration](/gateway/configuration)
- Config CLI: [Config](/cli/config)

## Options

- `--section <section>`: repeatable section filter

Available sections:

- `workspace`
- `model`
- `web`
- `gateway`
- `daemon`
- `channels`
- `plugins`
- `skills`
- `health`

Notes:

- The full wizard and gateway-related sections ask where the Gateway runs and update `gateway.mode`. Section filters that do not include `gateway`, `daemon`, or `health` go directly to the requested setup.
- After local config writes, configure installs selected downloadable plugins when the chosen setup path requires them. Remote gateway config does not install local plugin packages.
- Channel setup is scoped to Telegram and Discord. Discord setup can prompt for channel/room allowlists; you can enter names or IDs, and the wizard resolves names to IDs when possible.
- If you run the daemon install step, token auth requires a token, and `gateway.auth.token` is SecretRef-managed, configure validates the SecretRef but does not persist resolved plaintext token values into supervisor service environment metadata.
- If token auth requires a token and the configured token SecretRef is unresolved, configure blocks daemon install with actionable remediation guidance.
- If both `gateway.auth.token` and `gateway.auth.password` are configured and `gateway.auth.mode` is unset, configure blocks daemon install until mode is set explicitly.

## Examples

```bash
openclaw configure
openclaw configure --section web
openclaw configure --section model --section channels
openclaw configure --section gateway --section daemon
```

## Related

- [CLI reference](/cli)
- [Configuration](/gateway/configuration)
