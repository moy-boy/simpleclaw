---
summary: "CLI reference for `openclaw directory` (self, peers, groups)"
read_when:
  - You want to look up contacts/groups/self ids for a channel
  - You are developing a channel directory adapter
title: "Directory"
---

# `openclaw directory`

Directory lookups for channels that support it (contacts/peers, groups, and "me").

## Common flags

- `--channel <name>`: channel id/alias (required when multiple channels are configured; auto when only one is configured)
- `--account <id>`: account id (default: channel default)
- `--json`: output JSON

## Notes

- `directory` is meant to help you find IDs you can paste into other commands (especially `openclaw message send --target ...`).
- For many channels, results are config-backed (allowlists / configured groups) rather than a live provider directory.
- Installed channel plugins can still omit directory support; in that case the command reports the unsupported directory operation instead of reinstalling the plugin.
- Default output is `id` (and sometimes `name`) separated by a tab; use `--json` for scripting.

## Using results with `message send`

```bash
openclaw directory peers list --channel discord --query "Jane"
openclaw message send --channel discord --target user:123456789012345678 --message "hello"
```

## ID formats (by channel)

- Telegram: `@username` or numeric chat id; groups are numeric ids
- Discord: `user:<id>` and `channel:<id>`

## Self ("me")

```bash
openclaw directory self --channel discord
```

## Peers (contacts/users)

```bash
openclaw directory peers list --channel discord
openclaw directory peers list --channel discord --query "name"
openclaw directory peers list --channel discord --limit 50
```

## Groups

```bash
openclaw directory groups list --channel discord
openclaw directory groups list --channel discord --query "work"
openclaw directory groups members --channel discord --group-id <id>
```

## Related

- [CLI reference](/cli)
