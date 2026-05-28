---
summary: "web_search and web_fetch with the supported OpenAI-native search path"
title: "Web search"
sidebarTitle: "Web Search"
read_when:
  - You want to enable or configure web_search
  - You want to use OpenAI-native web search
  - You want to understand web_fetch and web_search policy
---

The supported bundled web surface is OpenAI-native `web_search` plus local
`web_fetch`. `web_search` is injected into eligible OpenAI Responses requests
when web search is enabled. `web_fetch` performs a plain guarded HTTP fetch and
readability extraction for specific URLs.

<Info>
  `web_search` is not browser automation. Use the [Web Browser](/tools/browser)
  for JS-heavy sites, logins, or interactive pages. Use
  [Web Fetch](/tools/web-fetch) when you already know the URL.
</Info>

## Quick start

<Steps>
  <Step title="Use an OpenAI Responses model">
    Native web search is available for OpenAI Responses traffic whose provider
    is `openai` and whose base URL is the official OpenAI API origin.
  </Step>
  <Step title="Keep web search enabled">
    `tools.web.search.enabled` defaults to `true`. Leave
    `tools.web.search.provider` unset, set it to `"auto"`, or set it to
    `"openai"` so OpenClaw can inject OpenAI's hosted `web_search` tool.
  </Step>
  <Step title="Call the tool when the model needs current information">
    The agent can request search through the normal `web_search` tool name:

    ```javascript
    await web_search({ query: "OpenClaw plugin SDK" });
    ```

  </Step>
</Steps>

## Native OpenAI web search

OpenClaw replaces the managed `web_search` function with OpenAI's hosted
Responses `web_search` tool when all of these are true:

- `tools.web.search.enabled` is not `false`
- `tools.web.search.provider` is unset, empty, `"auto"`, or `"openai"`
- the selected model uses `api: "openai-responses"`
- the selected provider is `openai`
- the model base URL is omitted or points at the official OpenAI API

If a request already contains a native OpenAI `web_search` tool, OpenClaw keeps
it and removes the duplicate managed function. If the request uses
`reasoning.effort: "minimal"`, OpenClaw raises it to `"low"` because OpenAI
native web search needs a reasoning level that supports tool use.

OpenAI-compatible proxy base URLs and Azure-style routes are not treated as
native OpenAI web search. They keep the managed function shape instead of
receiving OpenAI's hosted tool.

## Native Codex web search

Codex-capable models can use the provider-native Responses `web_search` tool
through `tools.web.search.openaiCodex`:

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        openaiCodex: {
          enabled: true,
          mode: "cached",
          allowedDomains: ["example.com"],
          contextSize: "high",
          userLocation: {
            country: "US",
            city: "New York",
            timezone: "America/New_York",
          },
        },
      },
    },
  },
}
```

This only activates for Codex-capable model routes such as `openai-codex/*` or
providers using `api: "openai-codex-responses"`. Non-Codex models keep the
normal OpenAI behavior above.

## Config

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        provider: "openai", // optional; unset or "auto" has the same supported effect
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
      },
    },
  },
}
```

Set `tools.web.search.enabled: false` to disable both the managed
`web_search` function and the native OpenAI search injection.

## Tool parameters

| Parameter     | Description                                             |
| ------------- | ------------------------------------------------------- |
| `query`       | Search query (required)                                 |
| `count`       | Requested result count, when the active backend uses it |
| `country`     | 2-letter ISO country code, when the backend uses it     |
| `language`    | ISO 639-1 language code, when the backend uses it       |
| `freshness`   | Time filter: `day`, `week`, `month`, or `year`          |
| `date_after`  | Results after this date (`YYYY-MM-DD`)                  |
| `date_before` | Results before this date (`YYYY-MM-DD`)                 |

OpenAI-native search may ignore managed-provider-only fields. Keep prompts
focused on the information need rather than relying on provider-specific
filter behavior.

## Network safety

Managed `web_search` and `web_fetch` calls use OpenClaw's guarded fetch path.
Private, loopback, link-local, and metadata destinations remain blocked unless
the relevant config explicitly opts into a trusted proxy or sandbox-specific
route.

Native OpenAI web search runs inside the OpenAI Responses API. OpenClaw controls
whether the native tool is sent, but the hosted search request itself is owned
by OpenAI.

## Tool profiles

If you use tool profiles or allowlists, add `web_search`, `web_fetch`, or
`group:web`:

```json5
{
  tools: {
    allow: ["web_search", "web_fetch"],
  },
}
```

## Related

- [Web Fetch](/tools/web-fetch) - fetch a URL and extract readable content
- [Web Browser](/tools/browser) - full browser automation for JS-heavy sites
- [OpenAI provider](/providers/openai) - OpenAI model and auth setup
