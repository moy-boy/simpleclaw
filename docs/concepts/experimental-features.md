---
summary: "What experimental flags mean in OpenClaw and which ones are currently documented"
title: "Experimental features"
read_when:
  - You see an `.experimental` config key and want to know whether it is stable
  - You want to try preview runtime features without confusing them with normal defaults
  - You want one place to find the currently documented experimental flags
---

Experimental features in OpenClaw are **opt-in preview surfaces**. They are
behind explicit flags because they still need real-world mileage before they
deserve a stable default or a long-lived public contract.

Treat them differently from normal config:

- Keep them **off by default** unless the related doc tells you to try one.
- Expect **shape and behavior to change** faster than stable config.
- Prefer the stable path first when one already exists.
- If you are rolling OpenClaw out broadly, test experimental flags in a smaller
  environment before baking them into a shared baseline.

## Currently documented flags

| Surface                  | Key                                                                     | Use it when                                                                                                                       | More                                                                                          |
| ------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Memory search            | `agents.defaults.memorySearch.experimental.sessionMemory`               | You want `memory_search` to index prior session transcripts and accept the extra storage/indexing cost                            | [Memory configuration reference](/reference/memory-config#session-memory-search-experimental) |
| Codex harness            | `plugins.entries.codex.config.appServer.experimental.sandboxExecServer` | You want native Codex app-server 0.132.0 or newer to target an OpenClaw sandbox-backed exec-server instead of disabling Code Mode | [Codex harness reference](/plugins/codex-harness-reference#sandboxed-native-execution)        |
| Structured planning tool | `tools.experimental.planTool`                                           | You want the structured `update_plan` tool exposed for multi-step work tracking in compatible runtimes and UIs                    | [Gateway configuration reference](/gateway/config-tools#toolsexperimental)                    |

## Experimental does not mean hidden

If a feature is experimental, OpenClaw should say so plainly in docs and in the
config path itself. What it should **not** do is smuggle preview behavior into a
stable-looking default knob and pretend that is normal. That's how config
surfaces get messy.

## Related

- [Features](/concepts/features)
- [Release channels](/install/development-channels)
