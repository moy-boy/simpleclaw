---
summary: "Text-to-speech with the supported OpenAI speech provider"
read_when:
  - Configuring text-to-speech
  - Sending spoken replies through Discord or Telegram
  - Tuning OpenAI TTS models and voices
title: "Text-to-speech"
sidebarTitle: "Text-to-speech"
---

The `tts` tool converts reply text into spoken audio with OpenAI. Discord and
Telegram can send the generated audio as message media; Discord voice can also
use TTS for playback in voice workflows.

## Quick start

<Steps>
  <Step title="Configure OpenAI auth">
    ```bash
    openclaw models auth login --provider openai --method api-key
    ```

    `OPENAI_API_KEY` in the Gateway environment also works.

  </Step>
  <Step title="Set the default TTS provider">
    ```json5
    {
      messages: {
        tts: {
          provider: "openai",
          providers: {
            openai: {
              model: "gpt-4o-mini-tts",
              voice: "alloy",
            },
          },
        },
      },
    }
    ```
  </Step>
  <Step title="Ask for spoken output">
    ```text
    Reply with a short spoken summary.
    ```
  </Step>
</Steps>

## OpenAI models and voices

| Field          | Supported values                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Models         | `gpt-4o-mini-tts`, `tts-1`, `tts-1-hd`                                                                                      |
| Default model  | `gpt-4o-mini-tts`                                                                                                           |
| Voices         | `alloy`, `ash`, `ballad`, `cedar`, `coral`, `echo`, `fable`, `juniper`, `marin`, `onyx`, `nova`, `sage`, `shimmer`, `verse` |
| Default voice  | `alloy`                                                                                                                     |
| Output formats | `mp3`, `opus`, `pcm`, `wav`                                                                                                 |

Instructions are sent to OpenAI when the model is `gpt-4o-mini-tts` or when you
use a custom OpenAI-compatible TTS endpoint.

## Config

```json5
{
  messages: {
    tts: {
      enabled: true,
      provider: "openai",
      providers: {
        openai: {
          model: "gpt-4o-mini-tts",
          voice: "alloy",
          responseFormat: "opus",
          timeoutMs: 30000,
        },
      },
    },
  },
}
```

Per-channel TTS config can override these defaults. Discord voice config merges
with `messages.tts`, so shared OpenAI provider settings do not need to be
duplicated for every Discord account.

## Tool usage

```javascript
await tts({
  text: "Here is the short spoken summary.",
  provider: "openai",
  voice: "alloy",
});
```

For chat replies, the agent usually does not need to call `tts` directly unless
the user asks for audio. Channel delivery remains responsible for attaching or
playing the generated audio.

## Related

- [OpenAI provider](/providers/openai)
- [Media overview](/tools/media-overview)
- [Discord channel](/channels/discord)
- [Telegram channel](/channels/telegram)
