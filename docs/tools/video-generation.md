---
summary: "Generate videos with OpenAI video generation"
read_when:
  - Generating videos via the agent
  - Configuring OpenAI video generation
  - Understanding the video_generate tool parameters
title: "Video generation"
sidebarTitle: "Video generation"
---

The `video_generate` tool lets the agent generate videos with OpenAI. It
supports text-to-video, image-to-video, and video-to-video modes when the
selected OpenAI model and account have access to the requested operation.

<Note>
  The tool only appears when OpenAI video generation is configured. Set
  `OPENAI_API_KEY` or `models.providers.openai.apiKey`, or configure
  `agents.defaults.videoGenerationModel`.
</Note>

## Quick start

<Steps>
  <Step title="Configure OpenAI auth">
    ```bash
    openclaw models auth login --provider openai --method api-key
    ```
  </Step>
  <Step title="Pick a default model (optional)">
    ```bash
    openclaw config set agents.defaults.videoGenerationModel.primary "openai/sora-2"
    ```
  </Step>
  <Step title="Ask the agent">
    ```text
    Generate a 5-second product reveal video with soft studio lighting.
    ```
  </Step>
</Steps>

## How async generation works

Video generation is asynchronous in session-backed agent runs:

1. OpenClaw submits the request to OpenAI and returns a task id.
2. OpenAI processes the job in the background.
3. OpenClaw wakes the same session with a completion event.
4. The agent attaches the finished video through the `message` tool.

Duplicate `video_generate` calls in the same session return the current task
status instead of starting another generation. Use `openclaw tasks list` or
`openclaw tasks show <taskId>` to inspect progress from the CLI.

## Supported OpenAI behavior

| Field            | Support                         |
| ---------------- | ------------------------------- |
| Default model    | `openai/sora-2`                 |
| Additional model | `openai/sora-2-pro`             |
| Text-to-video    | Supported                       |
| Image-to-video   | 1 reference image               |
| Video-to-video   | 1 reference video               |
| Max videos       | 1 per request                   |
| Max duration     | 12 seconds                      |
| Size hints       | Supported by OpenAI video route |

## Tool parameters

<ParamField path="prompt" type="string" required>
Text description of the video to generate.
</ParamField>
<ParamField path="action" type='"generate" | "status" | "list"' default="generate">
Use `"status"` to inspect the active session task or `"list"` to inspect
available providers and models.
</ParamField>
<ParamField path="model" type="string">
Provider/model override, for example `openai/sora-2-pro`.
</ParamField>
<ParamField path="image" type="string">
Single reference image path or URL.
</ParamField>
<ParamField path="video" type="string">
Single reference video path or URL.
</ParamField>
<ParamField path="durationSeconds" type="number">
Requested duration in seconds.
</ParamField>
<ParamField path="size" type="string">
OpenAI video size hint.
</ParamField>
<ParamField path="timeoutMs" type="number">
Optional provider request timeout in milliseconds.
</ParamField>

## Related

- [OpenAI provider](/providers/openai)
- [Media overview](/tools/media-overview)
- [Agent send](/tools/agent-send)
