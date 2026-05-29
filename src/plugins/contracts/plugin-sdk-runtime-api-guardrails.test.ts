import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { bundledPluginFile, getBundledPluginRoots } from "./test-helpers/bundled-plugin-roots.js";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const RUNTIME_API_EXPORT_GUARDS: Record<string, readonly string[]> = {
  [bundledPluginFile({ rootDir: ROOT_DIR, pluginId: "discord", relativePath: "runtime-api.ts" })]: [
    'export { discordMessageActions, handleDiscordAction, isDiscordModerationAction, readDiscordChannelCreateParams, readDiscordChannelEditParams, readDiscordChannelMoveParams, readDiscordModerationCommand, readDiscordParentIdParam, requiredGuildPermissionForModerationAction, type DiscordModerationAction, type DiscordModerationCommand } from "./runtime-api.actions.js";',
    'export { auditDiscordChannelPermissions, collectDiscordAuditChannelIds, fetchDiscordApplicationId, fetchDiscordApplicationSummary, listDiscordDirectoryGroupsLive, listDiscordDirectoryPeersLive, parseApplicationIdFromToken, probeDiscord, resolveDiscordChannelAllowlist, resolveDiscordPrivilegedIntentsFromFlags, resolveDiscordUserAllowlist, setDiscordRuntime, type DiscordApplicationSummary, type DiscordChannelResolution, type DiscordPrivilegedIntentsSummary, type DiscordPrivilegedIntentStatus, type DiscordProbe, type DiscordUserResolution } from "./runtime-api.lookup.js";',
    'export { DISCORD_ATTACHMENT_IDLE_TIMEOUT_MS, DISCORD_ATTACHMENT_TOTAL_TIMEOUT_MS, DISCORD_DEFAULT_INBOUND_WORKER_TIMEOUT_MS, DISCORD_DEFAULT_LISTENER_TIMEOUT_MS, allowListMatches, buildDiscordMediaPayload, clearGateways, clearPresences, createDiscordGatewayPlugin, createDiscordMessageHandler, createDiscordNativeCommand, getGateway, getPresence, isDiscordGroupAllowedByPolicy, mergeAbortSignals, monitorDiscordProvider, normalizeDiscordAllowList, normalizeDiscordSlug, presenceCacheSize, registerDiscordListener, registerGateway, resolveDiscordChannelConfig, resolveDiscordChannelConfigWithFallback, resolveDiscordCommandAuthorized, resolveDiscordGatewayIntents, resolveDiscordGuildEntry, resolveDiscordReplyTarget, resolveDiscordShouldRequireMention, resolveGroupDmAllow, sanitizeDiscordThreadName, setPresence, shouldEmitDiscordReactionNotification, unregisterGateway, waitForDiscordGatewayPluginRegistration, type DiscordAllowList, type DiscordChannelConfigResolved, type DiscordGuildEntryResolved, type DiscordMessageEvent, type DiscordMessageHandler, type MonitorDiscordOpts } from "./runtime-api.monitor.js";',
    'export { DiscordSendError, addRoleDiscord, banMemberDiscord, createChannelDiscord, createScheduledEventDiscord, createThreadDiscord, deleteChannelDiscord, deleteMessageDiscord, editChannelDiscord, editDiscordComponentMessage, editMessageDiscord, fetchChannelInfoDiscord, fetchChannelPermissionsDiscord, fetchMemberGuildPermissionsDiscord, fetchMemberInfoDiscord, fetchMessageDiscord, fetchReactionsDiscord, fetchRoleInfoDiscord, fetchVoiceStatusDiscord, hasAllGuildPermissionsDiscord, hasAnyGuildPermissionDiscord, kickMemberDiscord, listGuildChannelsDiscord, listGuildEmojisDiscord, listPinsDiscord, listScheduledEventsDiscord, listThreadsDiscord, moveChannelDiscord, pinMessageDiscord, reactMessageDiscord, readMessagesDiscord, registerBuiltDiscordComponentMessage, removeChannelPermissionDiscord, removeOwnReactionsDiscord, removeReactionDiscord, removeRoleDiscord, resolveDiscordOutboundSessionRoute, resolveEventCoverImage, searchMessagesDiscord, sendDiscordComponentMessage, sendMessageDiscord, sendPollDiscord, sendStickerDiscord, sendTypingDiscord, sendVoiceMessageDiscord, sendWebhookMessageDiscord, setChannelPermissionDiscord, timeoutMemberDiscord, unpinMessageDiscord, uploadEmojiDiscord, uploadStickerDiscord, type DiscordChannelCreate, type DiscordChannelEdit, type DiscordChannelMove, type DiscordChannelPermissionSet, type DiscordEmojiUpload, type DiscordMessageEdit, type DiscordMessageQuery, type DiscordModerationTarget, type DiscordPermissionsSummary, type DiscordReactionRuntimeContext, type DiscordReactionSummary, type DiscordReactionUser, type DiscordReactOpts, type DiscordRoleChange, type DiscordRuntimeAccountContext, type DiscordSearchQuery, type DiscordSendResult, type DiscordStickerUpload, type DiscordThreadCreate, type DiscordThreadList, type DiscordTimeoutTarget, type ResolveDiscordOutboundSessionRouteParams } from "./runtime-api.send.js";',
    'export { testing as __testing, testing, autoBindSpawnedDiscordSubagent, createNoopThreadBindingManager, createThreadBindingManager, formatThreadBindingDurationLabel, getThreadBindingManager, isRecentlyUnboundThreadWebhookMessage, listThreadBindingsBySessionKey, listThreadBindingsForAccount, reconcileAcpThreadBindingsOnStartup, resolveDiscordThreadBindingIdleTimeoutMs, resolveDiscordThreadBindingMaxAgeMs, resolveThreadBindingIdleTimeoutMs, resolveThreadBindingInactivityExpiresAt, resolveThreadBindingIntroText, resolveThreadBindingMaxAgeExpiresAt, resolveThreadBindingMaxAgeMs, resolveThreadBindingPersona, resolveThreadBindingPersonaFromRecord, resolveThreadBindingsEnabled, resolveThreadBindingThreadName, setThreadBindingIdleTimeoutBySessionKey, setThreadBindingMaxAgeBySessionKey, unbindThreadBindingsBySessionKey, type AcpThreadBindingReconciliationResult, type ThreadBindingManager, type ThreadBindingRecord, type ThreadBindingTargetKind } from "./runtime-api.threads.js";',
  ],
  [bundledPluginFile({ rootDir: ROOT_DIR, pluginId: "telegram", relativePath: "runtime-api.ts" })]:
    [
      'export type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";',
      'export type { ChannelMessageActionAdapter } from "openclaw/plugin-sdk/channel-contract";',
      'export type { TelegramApiOverride } from "./src/send.js";',
      'export type { OpenClawPluginService, OpenClawPluginServiceContext, PluginLogger } from "openclaw/plugin-sdk/plugin-entry";',
      'export type { PluginRuntime } from "openclaw/plugin-sdk/runtime-store";',
      'export type { AcpRuntime, AcpRuntimeCapabilities, AcpRuntimeDoctorReport, AcpRuntimeEnsureInput, AcpRuntimeEvent, AcpRuntimeHandle, AcpRuntimeStatus, AcpRuntimeTurnInput, AcpRuntimeErrorCode, AcpSessionUpdateTag } from "openclaw/plugin-sdk/acp-runtime";',
      'export { AcpRuntimeError } from "openclaw/plugin-sdk/acp-runtime";',
      'export { emptyPluginConfigSchema, formatPairingApproveHint, getChatChannelMeta } from "openclaw/plugin-sdk/channel-plugin-common";',
      'export { clearAccountEntryFields } from "openclaw/plugin-sdk/channel-core";',
      'export { buildChannelConfigSchema, TelegramConfigSchema } from "./config-api.js";',
      'export { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk/account-id";',
      'export { PAIRING_APPROVED_MESSAGE, buildTokenChannelStatusSummary, projectCredentialSnapshotFields, resolveConfiguredFromCredentialStatuses } from "openclaw/plugin-sdk/channel-status";',
      'export { jsonResult, readNumberParam, readReactionParams, readStringArrayParam, readStringOrNumberParam, readStringParam, resolvePollMaxSelections } from "openclaw/plugin-sdk/channel-actions";',
      'export type { TelegramProbe } from "./src/probe.js";',
      'export { auditTelegramGroupMembership, collectTelegramUnmentionedGroupIds } from "./src/audit.js";',
      'export { resolveTelegramRuntimeGroupPolicy } from "./src/group-access.js";',
      'export { buildTelegramExecApprovalPendingPayload, shouldSuppressTelegramExecApprovalForwardingFallback } from "./src/exec-approval-forwarding.js";',
      'export { telegramMessageActions } from "./src/channel-actions.js";',
      'export { monitorTelegramProvider } from "./src/monitor.js";',
      'export { probeTelegram } from "./src/probe.js";',
      'export { resolveTelegramFetch, resolveTelegramTransport, shouldRetryTelegramTransportFallback } from "./src/fetch.js";',
      'export { makeProxyFetch } from "./src/proxy.js";',
      'export { createForumTopicTelegram, deleteMessageTelegram, editForumTopicTelegram, editMessageReplyMarkupTelegram, editMessageTelegram, pinMessageTelegram, reactMessageTelegram, renameForumTopicTelegram, sendMessageTelegram, sendPollTelegram, sendStickerTelegram, sendTypingTelegram, unpinMessageTelegram } from "./src/send.js";',
      'export { createTelegramThreadBindingManager, getTelegramThreadBindingManager, resetTelegramThreadBindingsForTests, setTelegramThreadBindingIdleTimeoutBySessionKey, setTelegramThreadBindingMaxAgeBySessionKey } from "./src/thread-bindings.js";',
      'export { resolveTelegramToken } from "./src/token.js";',
      'export { setTelegramRuntime } from "./src/runtime.js";',
      'export type { ChannelPlugin } from "openclaw/plugin-sdk/channel-core";',
      'export type { OpenClawConfig } from "openclaw/plugin-sdk/config-contracts";',
      'export type TelegramAccountConfig = NonNullable< NonNullable<RuntimeOpenClawConfig["channels"]>["telegram"] >;',
      'export type TelegramActionConfig = NonNullable<TelegramAccountConfig["actions"]>;',
      'export type TelegramNetworkConfig = NonNullable<TelegramAccountConfig["network"]>;',
      'export { parseTelegramTopicConversation } from "./src/topic-conversation.js";',
      'export { resolveTelegramPollVisibility } from "./src/poll-visibility.js";',
    ],
} as const;

const RUNTIME_SETTER_EXPORT_GUARDS: Record<string, readonly string[]> = {
  [bundledPluginFile({
    rootDir: ROOT_DIR,
    pluginId: "discord",
    relativePath: "runtime-setter-api.ts",
  })]: ['export { setDiscordRuntime } from "./src/runtime.js";'],
  [bundledPluginFile({
    rootDir: ROOT_DIR,
    pluginId: "telegram",
    relativePath: "runtime-setter-api.ts",
  })]: ['export { setTelegramRuntime } from "./src/runtime.js";'],
} as const;

function collectRuntimeApiFiles(fileName: "runtime-api.ts" | "runtime-setter-api.ts"): string[] {
  return [...getBundledPluginRoots().entries()]
    .filter(([, rootDir]) => existsSync(resolve(rootDir, fileName)))
    .map(([pluginId]) =>
      bundledPluginFile({
        rootDir: ROOT_DIR,
        pluginId,
        relativePath: fileName,
      }),
    );
}

function readExportStatements(path: string): string[] {
  const sourceText = readFileSync(resolve(ROOT_DIR, "..", path), "utf8");
  const sourceFile = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true);

  return sourceFile.statements.flatMap((statement) => {
    if (!ts.isExportDeclaration(statement)) {
      const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
      if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        return [];
      }
      return [statement.getText(sourceFile).replaceAll(/\s+/g, " ").trim()];
    }

    const moduleSpecifier = statement.moduleSpecifier;
    if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) {
      return [statement.getText(sourceFile).replaceAll(/\s+/g, " ").trim()];
    }

    if (!statement.exportClause) {
      const prefix = statement.isTypeOnly ? "export type *" : "export *";
      return [`${prefix} from ${moduleSpecifier.getText(sourceFile)};`];
    }

    if (!ts.isNamedExports(statement.exportClause)) {
      return [statement.getText(sourceFile).replaceAll(/\s+/g, " ").trim()];
    }

    const specifiers = statement.exportClause.elements.map((element) => {
      const imported = element.propertyName?.text;
      const exported = element.name.text;
      const alias = imported ? `${imported} as ${exported}` : exported;
      return element.isTypeOnly ? `type ${alias}` : alias;
    });
    const exportPrefix = statement.isTypeOnly ? "export type" : "export";
    return [
      `${exportPrefix} { ${specifiers.join(", ")} } from ${moduleSpecifier.getText(sourceFile)};`,
    ];
  });
}

describe("runtime api guardrails", () => {
  it("keeps runtime api surfaces classified and guarded exports pinned", () => {
    const runtimeApiFiles = collectRuntimeApiFiles("runtime-api.ts");
    expect(runtimeApiFiles.toSorted()).toEqual(Object.keys(RUNTIME_API_EXPORT_GUARDS).toSorted());

    for (const file of Object.keys(RUNTIME_API_EXPORT_GUARDS).toSorted()) {
      expect(readExportStatements(file), `${file} runtime api exports changed`).toEqual(
        RUNTIME_API_EXPORT_GUARDS[file],
      );
    }
  });

  it("keeps bundled runtime api barrels off their own branded sdk facades", () => {
    for (const [pluginId, rootDir] of getBundledPluginRoots().entries()) {
      const path = resolve(rootDir, "runtime-api.ts");
      if (!existsSync(path)) {
        continue;
      }
      const source = readFileSync(path, "utf8");
      expect(
        source,
        `${pluginId} runtime api should use generic sdk subpaths or local exports`,
      ).not.toContain(`"openclaw/plugin-sdk/${pluginId}"`);
      expect(
        source,
        `${pluginId} runtime api should use generic sdk subpaths or local exports`,
      ).not.toContain(`'openclaw/plugin-sdk/${pluginId}'`);
    }
  });

  it("keeps bundled runtime-setter entrypoints narrow", () => {
    const runtimeSetterFiles = collectRuntimeApiFiles("runtime-setter-api.ts");
    expect(runtimeSetterFiles.toSorted()).toEqual(
      Object.keys(RUNTIME_SETTER_EXPORT_GUARDS).toSorted(),
    );

    for (const file of Object.keys(RUNTIME_SETTER_EXPORT_GUARDS).toSorted()) {
      expect(readExportStatements(file), `${file} runtime setter exports changed`).toEqual(
        RUNTIME_SETTER_EXPORT_GUARDS[file],
      );
    }
  });
});
