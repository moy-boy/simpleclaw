---
summary: "Fast Telegram and Discord troubleshooting"
read_when:
  - Channel transport says connected but replies fail
  - You need channel-specific checks before deep provider docs
title: "Channel troubleshooting"
---

Use this page when Telegram or Discord connects but behavior is wrong.

## Command ladder

Run these in order first:

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

Healthy baseline:

- `Runtime: running`
- `Connectivity probe: ok`
- `Capability: read-only`, `write-capable`, or `admin-capable`
- Channel probe shows transport connected and, where supported, `works` or `audit ok`

## After an update

Use this when Telegram or Discord disappears after updating.

```bash
openclaw status --all
openclaw doctor --fix
openclaw gateway restart
openclaw status --all
```

Look for `plugin load failed: dependency tree corrupted; run openclaw doctor --fix` in `openclaw status --all`. That means the channel is configured, but the plugin setup/load path hit a corrupt dependency tree instead of registering the channel. `openclaw doctor --fix` removes stale plugin dependency staging directories and stale auth shadows, then `openclaw gateway restart` reloads the clean state.

## Telegram

| Symptom                              | Fastest check                                    | Fix                                                                                                                        |
| ------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `/start` works but no usable replies | `openclaw pairing list telegram`                 | Approve pairing or change DM policy.                                                                                       |
| Bot online but group stays silent    | Verify mention requirement and bot privacy mode  | Disable privacy mode for group visibility or mention bot.                                                                  |
| Send failures with network errors    | Inspect logs for Telegram API call failures      | Fix DNS/IPv6/proxy routing to `api.telegram.org`.                                                                          |
| Startup reports `getMe returned 401` | Check configured token source                    | Re-copy or regenerate the BotFather token and update `botToken`, `tokenFile`, or default-account `TELEGRAM_BOT_TOKEN`.     |
| Polling stalls or reconnects slowly  | `openclaw logs --follow` for polling diagnostics | Upgrade; if restarts are false positives, tune `pollingStallThresholdMs`. Persistent stalls still point to proxy/DNS/IPv6. |
| `setMyCommands` rejected at startup  | Inspect logs for `BOT_COMMANDS_TOO_MUCH`         | Reduce plugin/skill/custom Telegram commands or disable native menus.                                                      |
| Upgraded and allowlist blocks you    | `openclaw security audit` and config allowlists  | Run `openclaw doctor --fix` or replace `@username` with numeric sender IDs.                                                |

Full troubleshooting: [Telegram troubleshooting](/channels/telegram#troubleshooting)

## Discord

| Symptom                                   | Fastest check                                                                                                                | Fix                                                                                                                                                                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bot online but no guild replies           | `openclaw channels status --probe`                                                                                           | Allow guild/channel and verify message content intent.                                                                                                                                                                                                                |
| Group messages ignored                    | Check logs for mention gating drops                                                                                          | Mention bot or set guild/channel `requireMention: false`.                                                                                                                                                                                                             |
| Typing/token usage but no Discord message | Check whether this is an ambient room event or an opted-in `message_tool` room where the model missed `message(action=send)` | Inspect the gateway verbose log for suppressed final payload metadata, verify `messages.groupChat.unmentionedInbound`, read [Ambient room events](/channels/ambient-room-events), or keep `messages.groupChat.visibleReplies: "automatic"` for normal group requests. |
| DM replies missing                        | `openclaw pairing list discord`                                                                                              | Approve DM pairing or adjust DM policy.                                                                                                                                                                                                                               |

Full troubleshooting: [Discord troubleshooting](/channels/discord#troubleshooting)

## Related

- [Pairing](/channels/pairing)
- [Channel routing](/channels/channel-routing)
- [Gateway troubleshooting](/gateway/troubleshooting)
