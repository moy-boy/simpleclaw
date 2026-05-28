const LIVEISH_INPUTS = Object.freeze([
  {
    probe: "provider-openai",
    env: ["OPENAI_API_KEY", "OPENAI_BASE_URL"],
  },
  {
    probe: "channel-telegram",
    env: ["TELEGRAM_BOT_TOKEN", "OPENCLAW_TELEGRAM_BOT_TOKEN"],
  },
  {
    probe: "channel-discord",
    env: ["DISCORD_TOKEN", "OPENCLAW_DISCORD_TOKEN"],
  },
]);

function hasValue(name) {
  return typeof process.env[name] === "string" && process.env[name].trim().length > 0;
}

const rows = LIVEISH_INPUTS.map((entry) => ({
  available: entry.env.some(hasValue),
  env: entry.env,
  probe: entry.probe,
}));

console.log("Plugin prerelease live-ish availability matrix:");
for (const row of rows) {
  const status = row.available ? "present" : "missing";
  console.log(`- ${row.probe}: ${status} (${row.env.join(", ")})`);
}

if (!rows.some((row) => row.available)) {
  console.log("No live-ish credentials present; skipping external probes by design.");
}
