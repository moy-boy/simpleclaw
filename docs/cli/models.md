---
summary: "CLI reference for `openclaw models` (status/list/set, aliases, fallbacks, auth)"
read_when:
  - You want to change default models or view OpenAI subscription auth status
  - You want to debug OpenAI subscription auth profiles
title: "Models"
---

# `openclaw models`

Model discovery and configuration for the simplified OpenAI subscription setup.

Related:

- Providers + models: [Models](/providers/models)
- Model selection concepts + `/models` slash command: [Models concept](/concepts/models)
- Provider auth setup: [Getting started](/start/getting-started)

## Common commands

```bash
openclaw models status
openclaw models list
openclaw models set <model-or-alias>
```

`openclaw models status` shows the resolved default/fallbacks plus an auth overview.
When provider usage snapshots are available, the auth status section includes
OpenAI Codex subscription usage windows and quota snapshots.
In `--json` output, `auth.providers` is the env/config/store-aware provider
overview, while `auth.oauth` is auth-store profile health only.
Add `--probe` to run live auth probes against each configured provider profile.
Probes are real requests (may consume tokens and trigger rate limits).
Use `--agent <id>` to inspect a configured agent's model/auth state. When omitted,
the command uses `OPENCLAW_AGENT_DIR`/`PI_CODING_AGENT_DIR` if set, otherwise the
configured default agent.
Probe rows can come from auth profiles, env credentials, or `models.json`.
For Codex OAuth troubleshooting, `openclaw models status`,
`openclaw models auth list --provider openai-codex`, and
`openclaw config get agents.defaults.model --json` are the quickest way to
confirm whether an agent has a usable `openai-codex` auth profile for
`openai/*` through the native Codex runtime. See [OpenAI provider setup](/providers/openai#check-and-recover-codex-oauth-routing).

Notes:

- `models set <model-or-alias>` accepts `provider/model` or an alias.
- `models list` is read-only: it reads config, auth profiles, existing catalog
  state, and provider-owned catalog rows, but it does not rewrite
  `models.json`.
- The `Auth` column is provider-level and read-only. It is computed from local
  auth profile metadata, env markers, configured provider keys, local-provider
  markers, AWS Bedrock env/profile markers, and plugin synthetic-auth metadata;
  it does not load provider runtime, read keychain secrets, call provider
  APIs, or prove exact per-model execution readiness.
- `models list --all --provider <id>` can include provider-owned static catalog
  rows from plugin manifests or bundled provider catalog metadata even when you
  have not authenticated with that provider yet. Those rows still show as
  unavailable until matching auth is configured.
- `models list` keeps the control plane responsive while provider catalog
  discovery is slow. The default and configured views fall back to configured or
  synthetic model rows after a short wait and let discovery finish in the
  background. Use `--all` when you need the exact full discovered catalog and
  are willing to wait for provider discovery.
- Broad `models list --all` merges manifest catalog rows over registry rows
  without loading provider runtime supplement hooks. Provider-filtered manifest
  fast paths use only providers marked `static`; providers marked `refreshable`
  stay registry/cache-backed and append manifest rows as supplements, while
  providers marked `runtime` stay on registry/runtime discovery.
- `models list` keeps native model metadata and runtime caps distinct. In table
  output, `Ctx` shows `contextTokens/contextWindow` when an effective runtime
  cap differs from the native context window; JSON rows include `contextTokens`
  when a provider exposes that cap.
- `models list --provider <id>` filters by provider id, such as `openai` or
  `openai-codex`. It does not accept display labels from interactive provider
  pickers.
- Model refs are parsed by splitting on the **first** `/`. The simplified setup
  uses OpenAI refs such as `openai/gpt-5.4`.
- If you omit the provider, OpenClaw resolves the input as an alias first, then
  as a unique configured-provider match for that exact model id, and only then
  falls back to the configured default provider with a deprecation warning.
  If that provider no longer exposes the configured default model, OpenClaw
  falls back to the first configured provider/model instead of surfacing a
  stale removed-provider default.
- `models status` may show `marker(<value>)` in auth output for non-secret placeholders (for example `OPENAI_API_KEY` or `secretref-managed`) instead of masking them as secrets.

### Models status

Options:

- `--json`
- `--plain`
- `--check` (exit 1=expired/missing, 2=expiring)
- `--probe` (live probe of configured auth profiles)
- `--probe-provider <name>` (probe one provider)
- `--probe-profile <id>` (repeat or comma-separated profile ids)
- `--probe-timeout <ms>`
- `--probe-concurrency <n>`
- `--probe-max-tokens <n>`
- `--agent <id>` (configured agent id; overrides `OPENCLAW_AGENT_DIR`/`PI_CODING_AGENT_DIR`)

`--json` keeps stdout reserved for the JSON payload. Auth-profile, provider,
and startup diagnostics are routed to stderr so scripts can pipe stdout directly
into tools such as `jq`.

Probe status buckets:

- `ok`
- `auth`
- `rate_limit`
- `billing`
- `timeout`
- `format`
- `unknown`
- `no_model`

Probe detail/reason-code cases to expect:

- `excluded_by_auth_order`: a stored profile exists, but explicit
  `auth.order.<provider>` omitted it, so probe reports the exclusion instead of
  trying it.
- `missing_credential`, `invalid_expires`, `expired`, `unresolved_ref`:
  profile is present but not eligible/resolvable.
- `no_model`: auth exists, but OpenClaw could not resolve a probeable
  model candidate for that provider.

## Aliases + fallbacks

```bash
openclaw models aliases list
openclaw models fallbacks list
```

## Auth profiles

```bash
openclaw models auth add
openclaw models auth list --provider openai [--json]
openclaw models auth login --provider openai
openclaw models auth login --provider openai --profile-id openai:work
```

`models auth add` is the interactive auth helper. In the simplified setup it
guides you through OpenAI subscription login.

`models auth list` lists saved auth profiles for the selected agent without
printing token, API-key, or OAuth secret material. Use `--provider <id>` to
filter to one provider, such as `openai-codex`, and `--json` for scripting.

`models auth login` runs the OpenAI subscription auth flow.
Use `openclaw models auth --agent <id> <subcommand>` to write auth results to a
specific configured agent store. The parent `--agent` flag is honored by `add`,
`list`, and `login`.

For OpenAI models, `--provider openai` defaults to ChatGPT/Codex account login.
The legacy `--provider openai-codex` spelling still works for existing scripts.

Examples:

```bash
openclaw models auth login --provider openai --set-default
openclaw models auth list --provider openai
```

Notes:

- `login` accepts `--profile-id <id>` so multiple OpenAI logins can stay
  separate.

## Related

- [CLI reference](/cli)
- [Model selection](/concepts/model-providers)
- [Model failover](/concepts/model-failover)
