---
summary: "web_fetch tool -- guarded HTTP fetch with readable content extraction"
read_when:
  - You want to fetch a URL and extract readable content
  - You need to configure web_fetch limits and caching
title: "Web fetch"
sidebarTitle: "Web Fetch"
---

The `web_fetch` tool does a plain HTTP GET and extracts readable content from a
specific URL. It does **not** execute JavaScript, click through pages, or use a
third-party scraping provider in the supported bundled build.

For JS-heavy sites or login-protected pages, use the
[Web Browser](/tools/browser) instead.

## Quick start

`web_fetch` is **enabled by default**. The agent can call it immediately:

```javascript
await web_fetch({ url: "https://example.com/article" });
```

## Tool parameters

<ParamField path="url" type="string" required>
URL to fetch. `http(s)` only.
</ParamField>

<ParamField path="extractMode" type="'markdown' | 'text'" default="markdown">
Output format after main-content extraction.
</ParamField>

<ParamField path="maxChars" type="number">
Truncate output to this many characters.
</ParamField>

## How it works

<Steps>
  <Step title="Fetch">
    Sends an HTTP GET with a Chrome-like User-Agent and `Accept-Language`
    header. OpenClaw blocks private/internal hostnames and re-checks redirects.
  </Step>
  <Step title="Extract">
    Runs Readability main-content extraction on HTML responses.
  </Step>
  <Step title="Cache">
    Caches results for 15 minutes by default to reduce repeated fetches of the
    same URL.
  </Step>
</Steps>

## Config

```json5
{
  tools: {
    web: {
      fetch: {
        enabled: true,
        maxChars: 50000,
        maxCharsCap: 50000,
        maxResponseBytes: 2000000,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
        maxRedirects: 3,
        useTrustedEnvProxy: false,
        readability: true,
        userAgent: "Mozilla/5.0 ...",
        ssrfPolicy: {
          allowRfc2544BenchmarkRange: true,
          allowIpv6UniqueLocalRange: true,
        },
      },
    },
  },
}
```

Leave the SSRF policy opt-ins unset unless an operator-controlled proxy owns
those synthetic ranges and enforces its own destination policy.

## Trusted env proxy

If your deployment requires `web_fetch` to go through a trusted outbound
HTTP(S) proxy, set `tools.web.fetch.useTrustedEnvProxy: true`.

In this mode, OpenClaw still applies hostname-based SSRF checks before sending
the request, but it lets the proxy resolve DNS instead of doing local DNS
pinning. Enable this only when the proxy is operator-controlled and enforces
outbound policy after DNS resolution.

<Note>
  If no HTTP(S) proxy env var is configured, or the target host is excluded by
  `NO_PROXY`, `web_fetch` falls back to the normal strict path with local DNS
  pinning.
</Note>

## Limits and safety

- `maxChars` is clamped to `tools.web.fetch.maxCharsCap`
- response bodies are capped at `maxResponseBytes` before parsing
- private/internal hostnames are blocked
- redirects are checked and limited by `maxRedirects`
- `useTrustedEnvProxy` is an explicit operator-controlled opt-in
- some sites still need the [Web Browser](/tools/browser)

## Tool profiles

If you use tool profiles or allowlists, add `web_fetch` or `group:web`:

```json5
{
  tools: {
    allow: ["web_fetch"],
  },
}
```

## Related

- [Web Search](/tools/web) - search with the supported OpenAI-native path
- [Web Browser](/tools/browser) - full browser automation for JS-heavy sites
