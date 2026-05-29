import { describePackageManifestContract } from "openclaw/plugin-sdk/plugin-test-contracts";

type PackageManifestContractParams = Parameters<typeof describePackageManifestContract>[0];

const packageManifestContractTests: PackageManifestContractParams[] = [
  {
    pluginId: "codex",
    pluginLocalRuntimeDeps: ["@openai/codex"],
    minHostVersionBaseline: "2026.5.1-beta.1",
  },
  {
    pluginId: "discord",
    pluginLocalRuntimeDeps: [
      "@discordjs/voice",
      "discord-api-types",
      "https-proxy-agent",
      "opusscript",
    ],
    minHostVersionBaseline: "2026.4.10",
  },
  { pluginId: "openai" },
  { pluginId: "telegram" },
];

for (const params of packageManifestContractTests) {
  describePackageManifestContract(params);
}
