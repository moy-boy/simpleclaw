---
summary: "Tools config (policy, experimental toggles, provider-backed tools) and custom provider/base-URL setup"
read_when:
  - Configuring `tools.*` policy, allowlists, or experimental features
  - Registering custom providers or overriding base URLs
  - Setting up OpenAI-compatible self-hosted endpoints
title: "Configuration — tools and custom providers"
sidebarTitle: "Tools and custom providers"
---

`tools.*` config keys and custom provider / base-URL setup. For agents, channels, and other top-level config keys, see [Configuration reference](/gateway/configuration-reference).

## Tools

### Tool profiles

`tools.profile` sets a base allowlist before `tools.allow`/`tools.deny`:

<Note>
Local onboarding defaults new local configs to `tools.profile: "coding"` when unset (existing explicit profiles are preserved).
</Note>

| Profile     | Includes                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `minimal`   | `session_status` only                                                                                                           |
| `coding`    | `group:fs`, `group:runtime`, `group:web`, `group:sessions`, `group:memory`, `cron`, `image`, `image_generate`, `video_generate` |
| `messaging` | `group:messaging`, `sessions_list`, `sessions_history`, `sessions_send`, `session_status`                                       |
| `full`      | No restriction (same as unset)                                                                                                  |

### Tool groups

| Group              | Tools                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `group:runtime`    | `exec`, `process` (`bash` is accepted as an alias for `exec`)                                                           |
| `group:fs`         | `read`, `write`, `edit`, `apply_patch`                                                                                  |
| `group:sessions`   | `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `sessions_yield`, `subagents`, `session_status` |
| `group:memory`     | `memory_search`, `memory_get`                                                                                           |
| `group:web`        | `web_search`, `web_fetch`                                                                                               |
| `group:ui`         | `browser`, `canvas`                                                                                                     |
| `group:automation` | `heartbeat_respond`, `cron`, `gateway`                                                                                  |
| `group:messaging`  | `message`                                                                                                               |
| `group:nodes`      | `nodes`                                                                                                                 |
| `group:agents`     | `agents_list`, `update_plan`                                                                                            |
| `group:media`      | `image`, `image_generate`, `video_generate`, `tts`                                                                      |
| `group:openclaw`   | All built-in tools (excludes provider plugins)                                                                          |
| `group:plugins`    | Tools owned by loaded plugins, including configured MCP servers exposed through `bundle-mcp`                            |

### MCP and plugin tools inside sandbox tool policy

Configured MCP servers are exposed as plugin-owned tools under the `bundle-mcp` plugin id. Normal tool profiles can allow them, but `tools.sandbox.tools` is an additional gate for sandboxed sessions. If sandbox mode is `"all"` or `"non-main"`, include one of these entries in the sandbox tool allowlist when MCP/plugin tools should be visible:

- `bundle-mcp` for OpenClaw-managed MCP servers from `mcp.servers`
- the plugin id for a specific native plugin
- `group:plugins` for all loaded plugin-owned tools
- exact MCP server tool names or server globs such as `outlook__send_mail` or `outlook__*` when you only want one server

Server globs use the provider-safe MCP server prefix, not necessarily the raw `mcp.servers` key. Non-`[A-Za-z0-9_-]` characters become `-`, names that do not start with a letter get an `mcp-` prefix, and long or duplicate prefixes may be truncated or suffixed; for example, `mcp.servers["Outlook Graph"]` uses a glob like `outlook-graph__*`.

```json5
{
  agents: { defaults: { sandbox: { mode: "all" } } },
  mcp: {
    servers: {
      outlook: { command: "node", args: ["./outlook-mcp.js"] },
    },
  },
  tools: {
    sandbox: {
      tools: {
        alsoAllow: ["web_search", "web_fetch", "memory_search", "memory_get", "bundle-mcp"],
      },
    },
  },
}
```

Without that sandbox-layer entry, the MCP server can still load successfully while its tools are filtered before the provider request. Use `openclaw doctor` to catch this shape for OpenClaw-managed servers in `mcp.servers`. MCP servers loaded from bundled plugin manifests use the same sandbox gate, but this diagnostic does not enumerate those sources yet; use the same allowlist entries if their tools disappear in sandboxed turns.

### `tools.allow` / `tools.deny`

Global tool allow/deny policy (deny wins). Case-insensitive, supports `*` wildcards. Applied even when Docker sandbox is off.

```json5
{
  tools: { deny: ["browser", "canvas"] },
}
```

`write` and `apply_patch` are separate tool ids. `allow: ["write"]` also enables `apply_patch` for compatible models, but `deny: ["write"]` does not deny `apply_patch`. To block all file mutation, deny `group:fs` or list each mutating tool explicitly:

```json5
{
  tools: { deny: ["write", "edit", "apply_patch"] },
}
```

### `tools.byProvider`

Further restrict tools for specific providers or models. Order: base profile → provider profile → allow/deny.

```json5
{
  tools: {
    profile: "coding",
    byProvider: {
      "google-antigravity": { profile: "minimal" },
      "openai/gpt-5.4": { allow: ["group:fs", "sessions_list"] },
    },
  },
}
```

### `tools.toolsBySender`

Restricts tools for a specific requester identity. This is defense-in-depth on top of channel access control; sender values must come from the channel adapter, not message text.

```json5
{
  tools: {
    toolsBySender: {
      "channel:discord:1234567890123": { alsoAllow: ["group:fs"] },
      "id:guest-user-id": { deny: ["group:runtime", "group:fs"] },
      "*": { deny: ["exec", "process", "write", "edit", "apply_patch"] },
    },
  },
}
```

Keys use explicit prefixes: `channel:<channelId>:<senderId>`, `id:<senderId>`, `e164:<phone>`, `username:<handle>`, `name:<displayName>`, or `"*"`. Channel ids are canonical OpenClaw ids; aliases such as `teams` normalize to `msteams`. Legacy unprefixed keys are accepted as `id:` only. Matching order is channel+id, id, e164, username, name, then wildcard.

Per-agent `agents.list[].tools.toolsBySender` overrides the global sender match when it matches, even with an empty `{}` policy.

### `tools.elevated`

Controls elevated exec access outside the sandbox:

```json5
{
  tools: {
    elevated: {
      enabled: true,
      allowFrom: {
        whatsapp: ["+15555550123"],
        discord: ["1234567890123", "987654321098765432"],
      },
    },
  },
}
```

- Per-agent override (`agents.list[].tools.elevated`) can only further restrict.
- `/elevated on|off|ask|full` stores state per session; inline directives apply to single message.
- Elevated `exec` bypasses sandboxing and uses the configured escape path (`gateway` by default, or `node` when the exec target is `node`).

### `tools.exec`

```json5
{
  tools: {
    exec: {
      backgroundMs: 10000,
      timeoutSec: 1800,
      cleanupMs: 1800000,
      notifyOnExit: true,
      notifyOnExitEmptySuccess: false,
      commandHighlighting: false,
      applyPatch: {
        enabled: false,
        allowModels: ["gpt-5.5"],
      },
    },
  },
}
```

### `tools.loopDetection`

Tool-loop safety checks are **disabled by default**. Set `enabled: true` to activate detection. Settings can be defined globally in `tools.loopDetection` and overridden per-agent at `agents.list[].tools.loopDetection`.

```json5
{
  tools: {
    loopDetection: {
      enabled: true,
      historySize: 30,
      warningThreshold: 10,
      criticalThreshold: 20,
      globalCircuitBreakerThreshold: 30,
      detectors: {
        genericRepeat: true,
        knownPollNoProgress: true,
        pingPong: true,
      },
    },
  },
}
```

<ParamField path="historySize" type="number">
  Max tool-call history retained for loop analysis.
</ParamField>
<ParamField path="warningThreshold" type="number">
  Repeating no-progress pattern threshold for warnings.
</ParamField>
<ParamField path="criticalThreshold" type="number">
  Higher repeating threshold for blocking critical loops.
</ParamField>
<ParamField path="globalCircuitBreakerThreshold" type="number">
  Hard stop threshold for any no-progress run.
</ParamField>
<ParamField path="detectors.genericRepeat" type="boolean">
  Warn on repeated same-tool/same-args calls.
</ParamField>
<ParamField path="detectors.knownPollNoProgress" type="boolean">
  Warn/block on known poll tools (`process.poll`, `command_status`, etc.).
</ParamField>
<ParamField path="detectors.pingPong" type="boolean">
  Warn/block on alternating no-progress pair patterns.
</ParamField>

<Warning>
If `warningThreshold >= criticalThreshold` or `criticalThreshold >= globalCircuitBreakerThreshold`, validation fails.
</Warning>

### `tools.web`

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        provider: "openai", // optional; unset or "auto" uses the supported OpenAI-native path
        maxResults: 5,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
      },
      fetch: {
        enabled: true,
        maxChars: 50000,
        maxCharsCap: 50000,
        maxResponseBytes: 2000000,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
        maxRedirects: 3,
        readability: true,
        userAgent: "custom-ua",
      },
    },
  },
}
```

### `tools.media`

Configures inbound media understanding (image/audio/video):

```json5
{
  tools: {
    media: {
      concurrency: 2,
      asyncCompletion: {
        directSend: false, // deprecated: completions stay agent-mediated
      },
      audio: {
        enabled: true,
        maxBytes: 20971520,
        scope: {
          default: "deny",
          rules: [{ action: "allow", match: { chatType: "direct" } }],
        },
        models: [
          { provider: "openai", model: "gpt-4o-mini-transcribe" },
          { type: "cli", command: "whisper", args: ["--model", "base", "{{MediaPath}}"] },
        ],
      },
      image: {
        enabled: true,
        timeoutSeconds: 180,
        models: [{ provider: "openai", model: "gpt-5.4", timeoutSeconds: 300 }],
      },
      video: {
        enabled: true,
        maxBytes: 52428800,
        models: [{ provider: "openai", model: "sora-2-pro" }],
      },
    },
  },
}
```

<AccordionGroup>
  <Accordion title="Media model entry fields">
    **Provider entry** (`type: "provider"` or omitted):

    - `provider`: API provider id. The supported bundled provider is `openai`.
    - `model`: model id override
    - `profile` / `preferredProfile`: `auth-profiles.json` profile selection

    **CLI entry** (`type: "cli"`):

    - `command`: executable to run
    - `args`: templated args (supports `{{MediaPath}}`, `{{Prompt}}`, `{{MaxChars}}`, etc.; `openclaw doctor --fix` migrates deprecated `{input}` placeholders to `{{MediaPath}}`)

    **Common fields:**

    - `capabilities`: optional list (`image`, `audio`, `video`). Defaults come from the selected OpenAI model metadata.
    - `prompt`, `maxChars`, `maxBytes`, `timeoutSeconds`, `language`: per-entry overrides.
    - `tools.media.image.timeoutSeconds` and matching image model `timeoutSeconds` entries also apply when the agent calls the explicit `image` tool.
    - Failures fall back to the next entry.

    Provider auth follows standard order: `auth-profiles.json` → env vars → `models.providers.*.apiKey`.

    **Async completion fields:**

    - `asyncCompletion.directSend`: deprecated compatibility flag. Completed async media tasks stay requester-session mediated so the agent receives the result, decides how to tell the user, and uses the message tool when source delivery requires it.

  </Accordion>
</AccordionGroup>

### `tools.agentToAgent`

```json5
{
  tools: {
    agentToAgent: {
      enabled: false,
      allow: ["home", "work"],
    },
  },
}
```

### `tools.sessions`

Controls which sessions can be targeted by the session tools (`sessions_list`, `sessions_history`, `sessions_send`).

Default: `tree` (current session + sessions spawned by it, such as subagents).

```json5
{
  tools: {
    sessions: {
      // "self" | "tree" | "agent" | "all"
      visibility: "tree",
    },
  },
}
```

<AccordionGroup>
  <Accordion title="Visibility scopes">
    - `self`: only the current session key.
    - `tree`: current session + sessions spawned by the current session (subagents).
    - `agent`: any session belonging to the current agent id (can include other users if you run per-sender sessions under the same agent id).
    - `all`: any session. Cross-agent targeting still requires `tools.agentToAgent`.
    - Sandbox clamp: when the current session is sandboxed and `agents.defaults.sandbox.sessionToolsVisibility="spawned"`, visibility is forced to `tree` even if `tools.sessions.visibility="all"`.

  </Accordion>
</AccordionGroup>

### `tools.sessions_spawn`

Controls inline attachment support for `sessions_spawn`.

```json5
{
  tools: {
    sessions_spawn: {
      attachments: {
        enabled: false, // opt-in: set true to allow inline file attachments
        maxTotalBytes: 5242880, // 5 MB total across all files
        maxFiles: 50,
        maxFileBytes: 1048576, // 1 MB per file
        retainOnSessionKeep: false, // keep attachments when cleanup="keep"
      },
    },
  },
}
```

<AccordionGroup>
  <Accordion title="Attachment notes">
    - Attachments are only supported for `runtime: "subagent"`. ACP runtime rejects them.
    - Files are materialized into the child workspace at `.openclaw/attachments/<uuid>/` with a `.manifest.json`.
    - Attachment content is automatically redacted from transcript persistence.
    - Base64 inputs are validated with strict alphabet/padding checks and a pre-decode size guard.
    - File permissions are `0700` for directories and `0600` for files.
    - Cleanup follows the `cleanup` policy: `delete` always removes attachments; `keep` retains them only when `retainOnSessionKeep: true`.

  </Accordion>
</AccordionGroup>

<a id="toolsexperimental"></a>

### `tools.experimental`

Experimental built-in tool flags. Default off unless a strict-agentic GPT-5 auto-enable rule applies.

```json5
{
  tools: {
    experimental: {
      planTool: true, // enable experimental update_plan
    },
  },
}
```

- `planTool`: enables the structured `update_plan` tool for non-trivial multi-step work tracking.
- Default: `false` unless `agents.defaults.embeddedPi.executionContract` (or a per-agent override) is set to `"strict-agentic"` for an OpenAI or OpenAI Codex GPT-5-family run. Set `true` to force the tool on outside that scope, or `false` to keep it off even for strict-agentic GPT-5 runs.
- When enabled, the system prompt also adds usage guidance so the model only uses it for substantial work and keeps at most one step `in_progress`.

### `agents.defaults.subagents`

```json5
{
  agents: {
    defaults: {
      subagents: {
        allowAgents: ["research"],
        model: "openai/gpt-5.5",
        maxConcurrent: 8,
        runTimeoutSeconds: 900,
        announceTimeoutMs: 120000,
        archiveAfterMinutes: 60,
      },
    },
  },
}
```

- `model`: default model for spawned sub-agents. If omitted, sub-agents inherit the caller's model.
- `allowAgents`: default allowlist of configured target agent ids for `sessions_spawn` when the requester agent does not set its own `subagents.allowAgents` (`["*"]` = any configured target; default: same agent only). Stale entries whose agent config was deleted are rejected by `sessions_spawn` and omitted from `agents_list`; run `openclaw doctor --fix` to clean them up.
- `runTimeoutSeconds`: default timeout (seconds) for `sessions_spawn` when the tool call omits `runTimeoutSeconds`. `0` means no timeout.
- `announceTimeoutMs`: per-call timeout (milliseconds) for gateway `agent` announce delivery attempts. Default: `120000`. Transient retries can make the total announce wait longer than one configured timeout.
- Per-subagent tool policy: `tools.subagents.tools.allow` / `tools.subagents.tools.deny`.

---

## Custom providers and base URLs

OpenClaw uses the built-in model catalog. Add custom providers via `models.providers` in config or `~/.openclaw/agents/<agentId>/agent/models.json`.

Configuring a custom/local provider `baseUrl` is also the narrow network trust decision for model HTTP requests: OpenClaw allows that exact `scheme://host:port` origin through the guarded fetch path, without adding a separate config option or trusting other private origins.

```json5
{
  models: {
    mode: "merge", // merge (default) | replace
    providers: {
      "custom-proxy": {
        baseUrl: "http://localhost:4000/v1",
        apiKey: "LITELLM_KEY",
        api: "openai-completions", // openai-completions | openai-responses | anthropic-messages | google-generative-ai
        models: [
          {
            id: "llama-3.1-8b",
            name: "Llama 3.1 8B",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            contextTokens: 96000,
            maxTokens: 32000,
          },
        ],
      },
    },
  },
}
```

<AccordionGroup>
  <Accordion title="Auth and merge precedence">
    - Use `authHeader: true` + `headers` for custom auth needs.
    - Override agent config root with `OPENCLAW_AGENT_DIR` (or `PI_CODING_AGENT_DIR`, a legacy environment variable alias).
    - Merge precedence for matching provider IDs:
      - Non-empty agent `models.json` `baseUrl` values win.
      - Non-empty agent `apiKey` values win only when that provider is not SecretRef-managed in current config/auth-profile context.
      - SecretRef-managed provider `apiKey` values are refreshed from source markers (`ENV_VAR_NAME` for env refs, `secretref-managed` for file/exec refs) instead of persisting resolved secrets.
      - SecretRef-managed provider header values are refreshed from source markers (`secretref-env:ENV_VAR_NAME` for env refs, `secretref-managed` for file/exec refs).
      - Empty or missing agent `apiKey`/`baseUrl` fall back to `models.providers` in config.
      - Matching model `contextWindow`/`maxTokens` use the higher value between explicit config and implicit catalog values.
      - Matching model `contextTokens` preserves an explicit runtime cap when present; use it to limit effective context without changing native model metadata.
      - Use `models.mode: "replace"` when you want config to fully rewrite `models.json`.
      - Marker persistence is source-authoritative: markers are written from the active source config snapshot (pre-resolution), not from resolved runtime secret values.

  </Accordion>
</AccordionGroup>

### Provider field details

<AccordionGroup>
  <Accordion title="Top-level catalog">
    - `models.mode`: provider catalog behavior (`merge` or `replace`).
    - `models.providers`: custom provider map keyed by provider id.
      - Safe edits: use `openclaw config set models.providers.<id> '<json>' --strict-json --merge` or `openclaw config set models.providers.<id>.models '<json-array>' --strict-json --merge` for additive updates. `config set` refuses destructive replacements unless you pass `--replace`.

  </Accordion>
  <Accordion title="Provider connection and auth">
    - `models.providers.*.api`: request adapter (`openai-completions`, `openai-responses`, `openai-codex-responses`). The simplified setup uses OpenAI subscription-backed provider config.
    - `models.providers.*.apiKey`: provider credential (prefer SecretRef/env substitution).
    - `models.providers.*.auth`: auth strategy (`api-key`, `token`, `oauth`, `aws-sdk`).
    - `models.providers.*.contextWindow`: default native context window for models under this provider when the model entry does not set `contextWindow`.
    - `models.providers.*.contextTokens`: default effective runtime context cap for models under this provider when the model entry does not set `contextTokens`.
    - `models.providers.*.maxTokens`: default output-token cap for models under this provider when the model entry does not set `maxTokens`.
    - `models.providers.*.timeoutSeconds`: optional per-provider model HTTP request timeout in seconds, including connect, headers, body, and total request abort handling.
    - `models.providers.*.injectNumCtxForOpenAICompat`: compatibility knob for OpenAI-compatible completions endpoints.
    - `models.providers.*.authHeader`: force credential transport in the `Authorization` header when required.
    - `models.providers.*.baseUrl`: upstream API base URL.
    - `models.providers.*.headers`: extra static headers for proxy/tenant routing.

  </Accordion>
  <Accordion title="Request transport overrides">
    `models.providers.*.request`: transport overrides for model-provider HTTP requests.

    - `request.headers`: extra headers (merged with provider defaults). Values accept SecretRef.
    - `request.auth`: auth strategy override. Modes: `"provider-default"` (use provider's built-in auth), `"authorization-bearer"` (with `token`), `"header"` (with `headerName`, `value`, optional `prefix`).
    - `request.proxy`: HTTP proxy override. Modes: `"env-proxy"` (use `HTTP_PROXY`/`HTTPS_PROXY` env vars), `"explicit-proxy"` (with `url`). Both modes accept an optional `tls` sub-object.
    - `request.tls`: TLS override for direct connections. Fields: `ca`, `cert`, `key`, `passphrase` (all accept SecretRef), `serverName`, `insecureSkipVerify`.
    - `request.allowPrivateNetwork`: when `true`, allow model-provider HTTP requests to private, CGNAT, or similar ranges through the provider HTTP fetch guard. Custom/local provider base URLs already trust the exact configured origin, except metadata/link-local origins, which remain blocked without explicit opt-in. Set this to `false` to opt out of exact-origin trust. WebSocket uses the same `request` for headers/TLS but not that fetch SSRF gate. Default `false`.

  </Accordion>
  <Accordion title="Model catalog entries">
    - `models.providers.*.models`: explicit provider model catalog entries.
    - `models.providers.*.models.*.input`: model input modalities. Use `["text"]` for text-only models and `["text", "image"]` for native image/vision models. Image attachments are only injected into agent turns when the selected model is marked image-capable.
    - `models.providers.*.models.*.contextWindow`: native model context window metadata. This overrides provider-level `contextWindow` for that model.
    - `models.providers.*.models.*.contextTokens`: optional runtime context cap. This overrides provider-level `contextTokens`; use it when you want a smaller effective context budget than the model's native `contextWindow`; `openclaw models list` shows both values when they differ.
    - `models.providers.*.models.*.compat.supportsDeveloperRole`: optional compatibility hint. For `api: "openai-completions"` with a non-empty non-native `baseUrl` (host not `api.openai.com`), OpenClaw forces this to `false` at runtime. Empty/omitted `baseUrl` keeps default OpenAI behavior.
    - `models.providers.*.models.*.compat.requiresStringContent`: optional compatibility hint for string-only OpenAI-compatible chat endpoints. When `true`, OpenClaw flattens pure text `messages[].content` arrays into plain strings before sending the request.
    - `models.providers.*.models.*.compat.strictMessageKeys`: optional compatibility hint for strict OpenAI-compatible chat endpoints. When `true`, OpenClaw strips outgoing Chat Completions message objects to `role` and `content` before sending the request.
    - `models.providers.*.models.*.compat.thinkingFormat`: optional thinking payload hint for explicitly configured OpenAI-compatible endpoints that need provider-specific request shaping.

  </Accordion>
  <Accordion title="Amazon Bedrock discovery">
    - `plugins.entries.amazon-bedrock.config.discovery`: Bedrock auto-discovery settings root.
    - `plugins.entries.amazon-bedrock.config.discovery.enabled`: turn implicit discovery on/off.
    - `plugins.entries.amazon-bedrock.config.discovery.region`: AWS region for discovery.
    - `plugins.entries.amazon-bedrock.config.discovery.providerFilter`: optional provider-id filter for targeted discovery.
    - `plugins.entries.amazon-bedrock.config.discovery.refreshInterval`: polling interval for discovery refresh.
    - `plugins.entries.amazon-bedrock.config.discovery.defaultContextWindow`: fallback context window for discovered models.
    - `plugins.entries.amazon-bedrock.config.discovery.defaultMaxTokens`: fallback max output tokens for discovered models.

  </Accordion>
</AccordionGroup>

Interactive custom-provider onboarding is outside the simplified supported surface. Use OpenAI subscription auth and `openai/<model>` refs for normal setup.

### Provider examples

The simplified setup supports OpenAI subscription-backed provider config only. Use `openai/<model>` refs and configure auth through `openclaw onboard --auth-choice openai-codex` or `openclaw models auth login --provider openai`.

```json5
{
  agents: {
    defaults: {
      model: { primary: "openai/gpt-5.5" },
    },
  },
}
```

## Related

- [Configuration — agents](/gateway/config-agents)
- [Configuration — channels](/gateway/config-channels)
- [Configuration reference](/gateway/configuration-reference) — other top-level keys
- [Tools and plugins](/tools)
