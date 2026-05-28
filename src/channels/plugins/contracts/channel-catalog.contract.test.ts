import {
  describeBundledMetadataOnlyChannelCatalogContract,
  describeChannelCatalogEntryContract,
  describeOfficialFallbackChannelCatalogContract,
} from "./test-helpers/channel-catalog-contract.js";

describeChannelCatalogEntryContract({
  channelId: "discord",
  npmSpec: "@openclaw/discord",
});

const telegramMeta = {
  id: "telegram",
  label: "Telegram",
  selectionLabel: "Telegram (Bot API)",
  detailLabel: "Telegram Bot",
  docsPath: "/channels/telegram",
  blurb: "register a bot with @BotFather and get going.",
};

describeBundledMetadataOnlyChannelCatalogContract({
  pluginId: "telegram",
  packageName: "@openclaw/telegram",
  npmSpec: "@openclaw/telegram",
  meta: telegramMeta,
});

describeOfficialFallbackChannelCatalogContract({
  channelId: "discord",
  npmSpec: "@openclaw/discord",
  meta: {
    id: "discord",
    label: "Discord",
    selectionLabel: "Discord (Bot API)",
    detailLabel: "Discord Bot",
    docsPath: "/channels/discord",
    blurb: "very well supported right now.",
  },
  packageName: "@openclaw/discord",
  pluginId: "discord",
  externalNpmSpec: "@vendor/discord-fork",
  externalLabel: "Discord Fork",
});
