---
summary: "How OpenClaw separates OpenAI providers, models, channels, and agent runtimes"
title: "Agent runtimes"
read_when:
  - You are choosing between the OpenAI Codex runtime and PI compatibility mode
  - You are confused by provider/model/runtime labels in status or config
---

An **agent runtime** owns one prepared model loop: it receives the prompt,
drives model output, handles native tool calls, and returns the finished turn to
OpenClaw.

In the simplified setup, only OpenAI subscription-backed model providers are
supported for agent turns.

| Layer         | Supported values                                       | What it means                                                      |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| Provider      | `openai`, `openai-codex`                               | How OpenClaw names OpenAI model refs and stores subscription auth. |
| Model         | `gpt-5.5`, `gpt-5.4`, and other OpenAI catalog entries | The model selected for the agent turn.                             |
| Agent runtime | `codex`, `pi`                                          | The loop implementation that executes the prepared turn.           |
| Channel       | Telegram, Discord                                      | Where messages enter and leave OpenClaw.                           |

## Codex surfaces

Several surfaces share the Codex name:

| Surface                               | OpenClaw name/config         | What it does                                                                    |
| ------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| Native Codex app-server runtime       | `openai/*` model refs        | Runs OpenAI subscription-backed agent turns by default.                         |
| OpenAI Codex auth profiles            | `openai-codex` auth provider | Stores ChatGPT/Codex subscription credentials.                                  |
| Native Codex chat-control command set | `/codex ...`                 | Binds, resumes, steers, stops, and inspects Codex app-server threads from chat. |

The common setup uses `openai-codex` for auth but keeps the model ref as
`openai/*`:

```json5
{
  agents: {
    defaults: {
      model: { primary: "openai/gpt-5.5" },
    },
  },
}
```

That means OpenClaw selects an OpenAI model ref, then asks the Codex app-server
runtime to run the embedded agent turn. It does not mean API-key billing.

## Runtime selection

OpenClaw chooses an embedded runtime after provider and model resolution:

1. Model-scoped runtime policy wins when explicitly configured under
   `agents.defaults.models["provider/model"].agentRuntime` or a matching
   agent-specific model entry.
2. Provider-scoped runtime policy comes next at
   `models.providers.<provider>.agentRuntime`.
3. In `auto` mode, OpenAI agent turns resolve to the bundled Codex runtime.
4. Explicit `agentRuntime.id: "pi"` is an opt-in compatibility route.

Whole-session and whole-agent runtime pins are ignored. Run
`openclaw doctor --fix` to remove stale whole-agent runtime config and convert
legacy runtime model refs where OpenClaw can preserve the intent.

Legacy `openai-codex/*`, `codex/*`, and `codex-cli/*` refs should be migrated to
`openai/*` with `openclaw doctor --fix`.

## Runtime ownership

| Surface                     | OpenClaw PI embedded                    | Codex app-server                                                            |
| --------------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| Model loop owner            | OpenClaw through the PI embedded runner | Codex app-server                                                            |
| Canonical thread state      | OpenClaw transcript                     | Codex thread, plus OpenClaw transcript mirror                               |
| OpenClaw dynamic tools      | Native OpenClaw tool loop               | Bridged through the Codex adapter                                           |
| Native shell and file tools | PI/OpenClaw path                        | Codex-native tools, bridged through native hooks where supported            |
| Context engine              | Native OpenClaw context assembly        | OpenClaw projects assembled context into the Codex turn                     |
| Compaction                  | OpenClaw or selected context engine     | Codex-native compaction, with OpenClaw notifications and mirror maintenance |
| Channel delivery            | OpenClaw                                | OpenClaw                                                                    |

Use the default Codex route for OpenAI subscription-backed agent work. Use PI
only when you explicitly need the compatibility path for a specific OpenAI model
turn.

## Related

- [OpenAI provider](/providers/openai)
- [Model providers](/concepts/model-providers)
- [Codex harness](/plugins/codex-harness)
