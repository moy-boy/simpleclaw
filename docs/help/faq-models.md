---
summary: "Model setup FAQ for the simplified OpenAI subscription surface"
read_when:
  - You have a model/auth error
  - You want to change the default model
  - You are troubleshooting OpenAI subscription auth
title: "Models FAQ"
---

## Which model providers are supported?

This simplified setup supports OpenAI subscription-backed agent turns only.
Use `openai/<model>` model refs, with subscription auth stored through the
`openai-codex` auth provider.

Examples:

```bash
openclaw models set openai/gpt-5.5
openclaw models set openai/gpt-5.4-mini
```

## How do I sign in?

Use onboarding or the model auth command:

```bash
openclaw onboard --auth-choice openai-codex
openclaw models auth login --provider openai --set-default
```

For remote/headless hosts:

```bash
openclaw onboard --auth-choice openai-codex-device-code
```

## Why does auth say `openai-codex` while my model says `openai/...`?

`openai-codex` is the subscription auth profile provider. `openai/<model>` is
the model ref users configure. OpenAI agent turns then run through the bundled
Codex runtime by default.

This is expected:

```json5
{
  agents: {
    defaults: {
      model: { primary: "openai/gpt-5.5" },
    },
  },
}
```

## How do I list available models?

```bash
openclaw models list --provider openai
openclaw models status
```

Add `--json` for scripting.

## How do I check whether auth works?

```bash
openclaw models status --probe
```

The probe makes a live request and may consume quota. For automation:

```bash
openclaw models status --check
```

Exit code `1` means expired or missing auth. Exit code `2` means expiring auth.

## How do I use a cheaper fallback?

Use another OpenAI model as the fallback:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "openai/gpt-5.5",
        fallbacks: ["openai/gpt-5.4-mini"],
      },
    },
  },
}
```

## Why did an unsupported provider fail?

The simplified runtime rejects non-OpenAI model providers during onboarding,
model setting, session patching, gateway model lists, and model auth flows.
Choose an `openai/<model>` ref instead.

## Related

- [Models CLI](/cli/models)
- [Model providers](/concepts/model-providers)
- [OpenAI provider](/providers/openai)
- [Authentication](/gateway/authentication)
