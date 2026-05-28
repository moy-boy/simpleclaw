---
summary: "Scripted onboarding and agent setup for the OpenClaw CLI"
read_when:
  - You are automating onboarding in scripts or CI
  - You need non-interactive OpenAI subscription setup examples
title: "CLI automation"
sidebarTitle: "CLI automation"
---

Use `--non-interactive` to automate `openclaw onboard`.

<Note>
`--json` does not imply non-interactive mode. Use `--non-interactive` (and `--workspace`) for scripts.
</Note>

## Baseline non-interactive example

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice openai-codex-device-code \
  --accept-risk \
  --gateway-port 18789 \
  --gateway-bind loopback \
  --install-daemon \
  --daemon-runtime node \
  --skip-bootstrap \
  --skip-skills
```

Add `--json` for a machine-readable summary.

Use `--skip-bootstrap` when your automation pre-seeds workspace files and does not want onboarding to create the default bootstrap files.

Onboarding rejects API-key, token-provider, custom-provider, and unsupported provider flags. Use `--auth-choice openai-codex`, `--auth-choice openai-codex-device-code`, or `--auth-choice skip`.

## Provider-specific examples

<AccordionGroup>
  <Accordion title="OpenAI subscription device pairing">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice openai-codex-device-code \
      --accept-risk \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Skip model auth for now">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice skip \
      --accept-risk \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
</AccordionGroup>

## Add another agent

Use `openclaw agents add <name>` to create a separate agent with its own workspace,
sessions, and auth profiles. Running without `--workspace` launches the wizard.

```bash
openclaw agents add work \
  --workspace ~/.openclaw/workspace-work \
  --model openai/gpt-5.5 \
  --bind telegram:default \
  --non-interactive \
  --json
```

What it sets:

- `agents.list[].name`
- `agents.list[].workspace`
- `agents.list[].agentDir`

Notes:

- Default workspaces follow `~/.openclaw/workspace-<agentId>`.
- Add `bindings` to route inbound messages (the wizard can do this).
- Non-interactive flags: `--model`, `--agent-dir`, `--bind`, `--non-interactive`.

## Related docs

- Onboarding hub: [Onboarding (CLI)](/start/wizard)
- Full reference: [CLI Setup Reference](/start/wizard-cli-reference)
- Command reference: [`openclaw onboard`](/cli/onboard)
