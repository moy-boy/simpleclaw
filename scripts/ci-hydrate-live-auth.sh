#!/usr/bin/env bash
set -euo pipefail

profile_path="${1:-${RUNNER_TEMP:-/tmp}/openclaw-live.profile}"

mkdir -p "$(dirname "$profile_path")"
: >"$profile_path"
chmod 600 "$profile_path"

append_profile_env() {
  local key="$1"
  local value="${!key:-}"
  if [[ -z "$value" || "$value" == "undefined" || "$value" == "null" ]]; then
    return
  fi
  printf 'export %s=%q\n' "$key" "$value" >>"$profile_path"
}

write_secret_file() {
  local destination="$1"
  local source_env="$2"
  local value="${!source_env:-}"
  if [[ -z "$value" ]]; then
    return
  fi
  mkdir -p "$(dirname "$destination")"
  printf '%s' "$value" >"$destination"
  chmod 600 "$destination"
}

for env_key in \
  OPENAI_API_KEY \
  OPENAI_BASE_URL \
  OPENCLAW_LIVE_BROWSER_CDP_URL \
  OPENCLAW_LIVE_SETUP_TOKEN \
  OPENCLAW_LIVE_SETUP_TOKEN_MODEL \
  OPENCLAW_LIVE_SETUP_TOKEN_PROFILE \
  OPENCLAW_LIVE_SETUP_TOKEN_VALUE
do
  append_profile_env "$env_key"
done

write_secret_file "$HOME/.codex/auth.json" OPENCLAW_CODEX_AUTH_JSON
write_secret_file "$HOME/.codex/config.toml" OPENCLAW_CODEX_CONFIG_TOML

if [[ -n "${GITHUB_ENV:-}" ]]; then
  {
    echo "OPENCLAW_PROFILE_FILE=$profile_path"
  } >>"$GITHUB_ENV"
fi
