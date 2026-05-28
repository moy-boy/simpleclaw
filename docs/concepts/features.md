---
summary: "OpenClaw capabilities across channels, routing, media, and UX."
read_when:
  - You want a full list of what OpenClaw supports
title: "Features"
---

## Highlights

<Columns>
  <Card title="Channels" icon="message-square" href="/channels">
    Telegram and Discord through one Gateway.
  </Card>
  <Card title="Plugins" icon="plug" href="/tools/plugin">
    Bundled plugins are limited to the simplified Telegram, Discord, OpenAI, and Codex surface.
  </Card>
  <Card title="Routing" icon="route" href="/concepts/multi-agent">
    Multi-agent routing with isolated sessions.
  </Card>
  <Card title="Media" icon="image" href="/nodes/images">
    Images, audio, video, documents, and image/video generation.
  </Card>
  <Card title="Apps and UI" icon="monitor" href="/web/control-ui">
    Web Control UI and macOS companion app.
  </Card>
  <Card title="Mobile nodes" icon="smartphone" href="/nodes">
    iOS and Android nodes with pairing, voice/chat, and rich device commands.
  </Card>
</Columns>

## Full list

**Channels:**

- Supported channels are Discord and Telegram
- Group chat support with mention-based activation
- DM safety with allowlists and pairing

**Agent:**

- Embedded agent runtime with tool streaming
- Multi-agent routing with isolated sessions per workspace or sender
- Sessions: direct chats collapse into shared `main`; groups are isolated
- Streaming and chunking for long responses

**Auth and providers:**

- OpenAI subscription-backed model access through OpenAI/Codex auth
- Browser OAuth and device-code subscription login
- Unsupported model providers, custom providers, and API-key onboarding are rejected in the simplified setup

**Media:**

- Images, audio, video, and documents in and out
- Shared image generation and video generation capability surfaces
- Voice note transcription
- Text-to-speech with multiple providers

**Apps and interfaces:**

- Browser Control UI
- macOS menu bar companion app
- iOS node with pairing, Canvas, camera, screen recording, location, and voice
- Android node with pairing, chat, voice, Canvas, camera, and device commands

**Tools and automation:**

- Browser automation, exec, sandboxing
- Web search and fetch tools when configured
- Cron jobs and heartbeat scheduling
- Skills, plugins, and workflow pipelines (Lobster)

## Related

<CardGroup cols={2}>
  <Card title="Experimental features" href="/concepts/experimental-features" icon="flask">
    Opt-in features that have not yet shipped to the default surface.
  </Card>
  <Card title="Agent runtime" href="/concepts/agent" icon="robot">
    Agent runtime model and how runs are dispatched.
  </Card>
  <Card title="Channels" href="/channels" icon="message-square">
    Connect Telegram and Discord from one Gateway.
  </Card>
  <Card title="Plugins" href="/tools/plugin" icon="plug">
    Bundled and third-party plugins that extend OpenClaw.
  </Card>
</CardGroup>
