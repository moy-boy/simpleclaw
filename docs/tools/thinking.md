---
summary: "Directive syntax for OpenAI reasoning and verbosity controls"
read_when:
  - Adjusting thinking, fast-mode, or verbose directive parsing or defaults
title: "Thinking levels"
---

OpenClaw supports chat directives that adjust reasoning, fast mode, verbosity,
trace output, and reasoning visibility. In the supported provider surface, these
controls are documented for OpenAI and OpenAI Codex routes.

## Thinking

Inline directive forms:

- `/t <level>`
- `/think:<level>`
- `/thinking <level>`

Supported canonical levels are `off`, `minimal`, `low`, `medium`, `high`, and
`xhigh` when the selected OpenAI model supports them. Aliases such as
`x-high`, `extra-high`, and `extra high` normalize to `xhigh`.

OpenAI GPT models map thinking through Responses API reasoning effort support.
`/think off` sends `reasoning.effort: "none"` only when the target model
supports it; otherwise OpenClaw omits the disabled reasoning payload instead of
sending an unsupported value.

## Resolution order

1. Inline directive on the message.
2. Session override from a directive-only message.
3. Per-agent default: `agents.list[].thinkingDefault`.
4. Global default: `agents.defaults.thinkingDefault`.
5. Provider-declared default when available.

## Set a session default

Send a message that is only the directive:

```text
/think:medium
```

Use `/think default` to clear the session override and inherit the configured
or provider default. `/think off` stores an explicit off override until you
change or clear it. Send `/think` with no argument to see the current level.

## Fast mode

`/fast on|off|default` toggles the session fast-mode override. For `openai/*`,
fast mode maps to OpenAI priority processing by sending
`service_tier=priority` on supported Responses requests. For
`openai-codex/*`, OpenClaw sends the same priority flag on Codex Responses.

Resolution order:

1. Inline/directive-only `/fast on|off`.
2. Session override.
3. Per-agent default: `agents.list[].fastModeDefault`.
4. Per-model config: `agents.defaults.models["<provider>/<model>"].params.fastMode`.
5. Fallback: `off`.

## Verbose directives

`/verbose on|full|off` controls tool-progress detail for the current session.
`/v` is an alias.

- `on`: show compact tool summaries.
- `full`: also forward truncated tool output after completion.
- `off`: hide normal tool-progress summaries.

`agents.defaults.toolProgressDetail` controls whether summaries use compact
human labels or raw command/detail text.

## Reasoning visibility

`/reasoning on|off|stream` controls whether reasoning is shown in replies.
When enabled, reasoning is sent as a separate message prefixed with `Thinking`.
`stream` is Telegram-only and streams reasoning into the Telegram draft bubble
while the reply is generating.

## Related

- [OpenAI provider](/providers/openai)
- [Elevated mode](/tools/elevated)
