import type { OpenClawConfig } from "../config/types.openclaw.js";
import {
  isSupportedModelProviderId,
  shouldEnforceSupportedModelProviderIds,
} from "../supported-surface.js";
import type { ModelCatalogEntry } from "./model-catalog.js";
import { createProviderAuthChecker } from "./model-provider-auth.js";
import { modelKey } from "./model-selection-normalize.js";
import { buildConfiguredModelCatalog } from "./model-selection-shared.js";
import { createModelVisibilityPolicy } from "./model-visibility-policy.js";

type ModelCatalogVisibilityView = "default" | "configured" | "all";
type ProviderAuthChecker = (provider: string) => boolean | Promise<boolean>;

function isPromiseLike(value: boolean | Promise<boolean>): value is Promise<boolean> {
  return typeof value === "object" && value !== null && typeof value.then === "function";
}

async function providerHasAuth(
  providerAuthChecker: ProviderAuthChecker,
  provider: string,
): Promise<boolean> {
  const result = providerAuthChecker(provider);
  return isPromiseLike(result) ? await result : result;
}

function sortModelCatalogEntries(entries: ModelCatalogEntry[]): ModelCatalogEntry[] {
  return entries.toSorted(
    (a, b) => a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id),
  );
}

function dedupeModelCatalogEntries(entries: ModelCatalogEntry[]): ModelCatalogEntry[] {
  const seen = new Set<string>();
  const next: ModelCatalogEntry[] = [];
  for (const entry of entries) {
    const key = modelKey(entry.provider, entry.id);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(entry);
  }
  return next;
}

function filterSupportedModelCatalogEntries(params: {
  cfg: OpenClawConfig;
  entries: ModelCatalogEntry[];
}): ModelCatalogEntry[] {
  if (process.env.VITEST !== undefined || !shouldEnforceSupportedModelProviderIds(params.cfg)) {
    return params.entries;
  }
  return params.entries.filter((entry) => isSupportedModelProviderId(entry.provider));
}

export async function resolveVisibleModelCatalog(params: {
  cfg: OpenClawConfig;
  catalog: ModelCatalogEntry[];
  defaultProvider: string;
  defaultModel?: string;
  agentId?: string;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  view?: ModelCatalogVisibilityView;
  runtimeAuthDiscovery?: boolean;
  providerAuthChecker?: ProviderAuthChecker;
}): Promise<ModelCatalogEntry[]> {
  const catalog = filterSupportedModelCatalogEntries({
    cfg: params.cfg,
    entries: params.catalog,
  });
  if (params.view === "all") {
    return catalog;
  }

  const buildDefaultVisibleCatalog = async () => {
    const configuredCatalog = sortModelCatalogEntries(
      filterSupportedModelCatalogEntries({
        cfg: params.cfg,
        entries: buildConfiguredModelCatalog({ cfg: params.cfg }),
      }),
    );
    const hasAuth =
      params.providerAuthChecker ??
      createProviderAuthChecker({
        cfg: params.cfg,
        workspaceDir: params.workspaceDir,
        agentId: params.agentId,
        env: params.env,
        allowPluginSyntheticAuth: params.runtimeAuthDiscovery,
        discoverExternalCliAuth: params.runtimeAuthDiscovery,
      });
    const authBackedCatalog: ModelCatalogEntry[] = [];
    for (const entry of catalog) {
      if (await providerHasAuth(hasAuth, entry.provider)) {
        authBackedCatalog.push(entry);
      }
    }
    return sortModelCatalogEntries(
      dedupeModelCatalogEntries([...configuredCatalog, ...authBackedCatalog]),
    );
  };

  const policy = createModelVisibilityPolicy({
    cfg: params.cfg,
    catalog,
    defaultProvider: params.defaultProvider,
    defaultModel: params.defaultModel,
    agentId: params.agentId,
  });
  const defaultVisibleCatalog =
    policy.allowAny || policy.hasProviderWildcards ? await buildDefaultVisibleCatalog() : [];
  return filterSupportedModelCatalogEntries({
    cfg: params.cfg,
    entries: sortModelCatalogEntries(
      dedupeModelCatalogEntries(
        policy.visibleCatalog({
          catalog,
          defaultVisibleCatalog,
          view: params.view,
        }),
      ),
    ),
  });
}
