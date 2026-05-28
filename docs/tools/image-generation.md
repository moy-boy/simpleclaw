---
summary: "Generate and edit images with OpenAI image generation"
read_when:
  - Generating or editing images via the agent
  - Configuring OpenAI image generation
  - Understanding the image_generate tool parameters
title: "Image generation"
sidebarTitle: "Image generation"
---

The `image_generate` tool lets the agent create and edit images with OpenAI.
In chat sessions, image generation runs asynchronously: OpenClaw records a
background task, returns the task id immediately, and wakes the agent when
OpenAI finishes. The completion agent sends generated images through the
`message` tool.

<Note>
  The tool only appears when an OpenAI image-generation route is configured.
  Configure `OPENAI_API_KEY`, `models.providers.openai.apiKey`, or an OpenAI
  Codex OAuth profile.
</Note>

## Quick start

<Steps>
  <Step title="Configure OpenAI auth">
    ```bash
    openclaw models auth login --provider openai --method api-key
    ```

    For gateway installs, `OPENAI_API_KEY` in the Gateway environment also
    works.

  </Step>
  <Step title="Pick a default model (optional)">
    ```json5
    {
      agents: {
        defaults: {
          imageGenerationModel: {
            primary: "openai/gpt-image-2",
            timeoutMs: 180000,
          },
        },
      },
    }
    ```
  </Step>
  <Step title="Ask the agent">
    ```text
    Generate an image of a clean product mockup on a white desk.
    ```

    The agent calls `image_generate` automatically when the tool is available.

  </Step>
</Steps>

## OpenAI routes

| Goal                                                 | Model ref              | Auth               |
| ---------------------------------------------------- | ---------------------- | ------------------ |
| Default OpenAI image generation                      | `openai/gpt-image-2`   | `OPENAI_API_KEY`   |
| Transparent-background PNG/WebP                      | `openai/gpt-image-1.5` | `OPENAI_API_KEY`   |
| OpenAI image generation with Codex subscription auth | `openai/gpt-image-2`   | OpenAI Codex OAuth |

When an `openai-codex` OAuth profile is configured, OpenClaw can route image
requests through that profile. Explicit `models.providers.openai` config with
an API key or custom base URL opts into the direct OpenAI Images API route.

## Supported OpenAI behavior

| Capability       | Support                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Generate         | Up to 4 images per request                                                                |
| Edit / reference | Up to 5 input images                                                                      |
| Sizes            | `1024x1024`, `1536x1024`, `1024x1536`, `2048x2048`, `2048x1152`, `3840x2160`, `2160x3840` |
| Output formats   | `png`, `jpeg`, `webp`                                                                     |
| Background hints | `transparent`, `opaque`, `auto`                                                           |
| Quality hints    | `low`, `medium`, `high`, `auto`                                                           |
| Default timeout  | 180 seconds for OpenAI, 600 seconds for Azure-style OpenAI endpoints                      |

## Tool parameters

<ParamField path="prompt" type="string" required>
Image generation prompt. Required for `action: "generate"`.
</ParamField>
<ParamField path="action" type='"generate" | "status" | "list"' default="generate">
Use `"status"` to inspect the active session task or `"list"` to inspect
available providers and models at runtime.
</ParamField>
<ParamField path="model" type="string">
Provider/model override, for example `openai/gpt-image-2`.
</ParamField>
<ParamField path="image" type="string">
Single reference image path or URL for edit mode.
</ParamField>
<ParamField path="images" type="string[]">
Multiple reference images for edit mode.
</ParamField>
<ParamField path="size" type="string">
Size hint, for example `1024x1024` or `1536x1024`.
</ParamField>
<ParamField path="quality" type='"low" | "medium" | "high" | "auto"'>
OpenAI quality hint.
</ParamField>
<ParamField path="outputFormat" type='"png" | "jpeg" | "webp"'>
Output format hint.
</ParamField>
<ParamField path="background" type='"transparent" | "opaque" | "auto"'>
Background hint. Use `transparent` with `png` or `webp`.
</ParamField>
<ParamField path="count" type="number">
Number of images to generate, clamped to 1-4.
</ParamField>
<ParamField path="timeoutMs" type="number">
Optional provider request timeout in milliseconds.
</ParamField>

## Related

- [OpenAI provider](/providers/openai)
- [Media overview](/tools/media-overview)
- [Agent send](/tools/agent-send)
