---
summary: "Analyze one or more PDF documents with the supported OpenAI fallback path"
title: "PDF tool"
read_when:
  - You want to analyze PDFs from agents
  - You need exact pdf tool parameters and limits
---

`pdf` analyzes one or more PDF documents and returns text. In the supported
bundled setup, the tool extracts PDF text first and uses the configured OpenAI
model when model analysis is needed.

## Availability

The tool is registered when OpenClaw can resolve a usable model config for the
agent:

1. `agents.defaults.pdfModel`
2. `agents.defaults.imageModel`
3. the agent's resolved session/default model

If no usable model can be resolved, the `pdf` tool is not exposed.

## Input reference

<ParamField path="pdf" type="string">
One PDF path or URL.
</ParamField>

<ParamField path="pdfs" type="string[]">
Multiple PDF paths or URLs, up to 10 total.
</ParamField>

<ParamField path="prompt" type="string" default="Analyze this PDF document.">
Analysis prompt.
</ParamField>

<ParamField path="pages" type="string">
Page filter like `1-5` or `1,3,7-9`.
</ParamField>

<ParamField path="model" type="string">
Optional model override in `provider/model` form, for example `openai/gpt-5.5`.
</ParamField>

<ParamField path="maxBytesMb" type="number">
Per-PDF size cap in MB. Defaults to `agents.defaults.pdfMaxBytesMb` or `10`.
</ParamField>

## Supported references

- local file path, including `~` expansion
- `file://` URL
- `http://` and `https://` URL
- OpenClaw-managed inbound refs such as `media://inbound/<id>`

Other URI schemes are rejected. In sandbox mode, remote `http(s)` URLs are
rejected. With workspace-only file policy enabled, local file paths outside
allowed roots are rejected.

## Extraction flow

1. Extract text from selected pages, up to `agents.defaults.pdfMaxPages`
   (default `20`).
2. If extracted text is very short, render selected pages to images when image
   fallback is available.
3. Send extracted content plus the prompt to the selected OpenAI model.

## Config

```json5
{
  agents: {
    defaults: {
      pdfModel: {
        primary: "openai/gpt-5.5",
      },
      pdfMaxBytesMb: 10,
      pdfMaxPages: 20,
    },
  },
}
```

## Related

- [Media support](/nodes/images)
- [Tools and custom providers](/gateway/config-tools)
