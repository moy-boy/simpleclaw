---
summary: "OpenAI subscription model provider support in OpenClaw"
read_when:
  - You need the supported model provider list
  - You want example OpenAI subscription auth and model-selection config
title: "Model providers"
sidebarTitle: "Model providers"
---

OpenClaw's simplified model surface supports OpenAI subscription-backed agent
turns only. Use ChatGPT/Codex subscription auth, configure `openai/<model>`
refs for agents, and leave non-OpenAI providers out of runtime config.

For chat delivery providers, see [Channels](/channels).

## Supported provider

| Surface                    | Supported value        | Notes                                                                       |
| -------------------------- | ---------------------- | --------------------------------------------------------------------------- |
| Provider plugin            | `openai`               | Bundled plugin that owns OpenAI and Codex subscription auth metadata.       |
| Subscription auth provider | `openai-codex`         | Stores ChatGPT/Codex OAuth or device-code auth profiles.                    |
| Agent model refs           | `openai/<model>`       | OpenAI refs route agent turns through the bundled Codex runtime by default. |
| Legacy model refs          | `openai-codex/<model>` | `openclaw doctor --fix` rewrites these to `openai/<model>`.                 |

The most common default model shape is:

```json5
{
  agents: {
    defaults: {
      model: { primary: "openai/gpt-5.5" },
    },
  },
}
```

## Auth setup

Use the onboarding wizard or the model auth command:

```bash
openclaw onboard --auth-choice openai-codex
openclaw models auth login --provider openai --set-default
```

Device-code auth is also supported for remote/headless hosts:

```bash
openclaw onboard --auth-choice openai-codex-device-code
```

`openclaw models auth add` is an interactive shortcut for the same OpenAI
subscription login surface.

## Runtime split

OpenAI agent turns use `openai/<model>` refs even when the credential is stored
under `openai-codex`. The separation is intentional:

- `openai-codex` names the subscription auth profile provider.
- `openai/<model>` names the model ref users configure.
- The bundled `codex` runtime executes OpenAI subscription-backed agent turns by
  default.

Use `openclaw doctor --fix` after migrating older config that still contains
`openai-codex/*` or `codex-cli/*` model refs.

## Rejected surfaces

This setup rejects non-OpenAI model providers during onboarding, config writes,
session model switches, gateway model lists, and provider auth flows. Examples
of unsupported model refs include non-OpenAI hosted providers, local model
servers, aggregators, and custom provider ids.

If `openclaw models set` or a chat `/model` command fails with an unsupported
provider error, choose an `openai/<model>` ref instead.

## Related

- [OpenAI provider](/providers/openai)
- [Models concept](/concepts/models)
- [Models CLI](/cli/models)
- [Authentication](/gateway/authentication)
