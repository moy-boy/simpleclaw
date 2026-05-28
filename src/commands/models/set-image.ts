import { logConfigUpdated } from "../../config/logging.js";
import { resolveAgentModelPrimaryValue } from "../../config/model-input.js";
import type { RuntimeEnv } from "../../runtime.js";
import {
  formatUnsupportedModelRefMessage,
  isSupportedModelRef,
  shouldEnforceSupportedModelProviderIds,
} from "../supported-surface.js";
import { applyDefaultModelPrimaryUpdate, updateConfig } from "./shared.js";

export async function modelsSetImageCommand(modelRaw: string, runtime: RuntimeEnv) {
  const updated = await updateConfig((cfg) => {
    if (shouldEnforceSupportedModelProviderIds(cfg) && !isSupportedModelRef(modelRaw)) {
      throw new Error(formatUnsupportedModelRefMessage(modelRaw));
    }
    return applyDefaultModelPrimaryUpdate({ cfg, modelRaw, field: "imageModel" });
  });

  logConfigUpdated(runtime);
  runtime.log(
    `Image model: ${resolveAgentModelPrimaryValue(updated.agents?.defaults?.imageModel) ?? modelRaw}`,
  );
}
