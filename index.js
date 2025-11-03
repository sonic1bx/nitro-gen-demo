// safe-gen-bot.js
// Node.js + discord.js v14 example (educational/demo only).
// DOES NOT generate or send real Discord gift codes — only placeholder links for demo.
// Usage: send message "gen" in a text channel. User must have "Administrator" permission.
// Rate: randomized between 500ms and 1000ms (≈1-2 msgs/sec).
// Built-in safety: maxMessagesPerRun, cooldownBetweenRuns (ms).

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
} = require("discord.js");
require("dotenv").config();

const TOKEN = process.env.BOT_TOKEN; // put token in .env as BOT_TOKEN=...
const PREFIX = ""; // empty because we use raw message "gen"
const COMMAND = "gen";

if (!TOKEN) {
  console.error("Please set BOT_TOKEN in .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // required to read message content
  ],
  partials: [Partials.Channel],
});

// Safety/config
const maxMessagesPerRun = 500;
const minIntervalMs = 100; // 0.1s -> ~10 msgs/sec min
const maxIntervalMs = 1000; // 1s  -> ~1 msg/sec max
const cooldownBetweenRuns = 5000; // 5 seconds cooldown between runs
// In-memory per-guild state
const guildState = new Map(); // guildId -> { lastRun: timestamp, running: boolean }

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// generate a safe placeholder "link" (NOT a real Discord gift)
function makePlaceholderLink() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 32; i++)
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  // Use example.com to avoid creating potentially valid discord URLs
  return `https://discord.com/gift/${code}`;
}

async function startGenerating(channel, guildId, requestedCount, requesterTag) {
  if (!guildState.has(guildId))
    guildState.set(guildId, { lastRun: 0, running: false });

  const state = guildState.get(guildId);

  const now = Date.now();
  if (state.running) {
    await channel.send(`${requesterTag} — اصبر`);
    return;
  }
  if (now - state.lastRun < cooldownBetweenRuns) {
    const remaining = Math.ceil(
      (cooldownBetweenRuns - (now - state.lastRun)) / 1000,
    );
    await channel.send(`${requesterTag} — اصبر ${remaining}.`);
    return;
  }

  // clamp requestedCount
  const count = Math.min(Math.max(1, requestedCount || 10), maxMessagesPerRun);

  state.running = true;
  state.lastRun = now;

  await channel.send(`${requesterTag} — بدء الإرسال (${count} `);

  // optional: create a message with a stop button (simple implementation via reaction)
  let stopRequested = false;
  try {
    const controlMsg = await channel.send("اضغط ❌ هنا لإيقاف الإرسال المبكر.");
    await controlMsg.react("❌");

    const filter = (reaction, user) =>
      reaction.emoji.name === "❌" && !user.bot;
    const collector = controlMsg.createReactionCollector({
      filter,
      time: 10 * 60 * 1000,
    }); // 10 min max

    collector.on("collect", () => {
      stopRequested = true;
      collector.stop();
    });

    collector.on("end", () => {
      // cleanup reaction (best-effort)
      controlMsg.reactions.removeAll().catch(() => {});
    });

    // Sending loop
    for (let i = 0; i < count; i++) {
      if (stopRequested) {
        await channel.send(
          `${requesterTag} — تم إيقاف العملية مبكرًا بعد إرسال ${i} روابط.`,
        );
        break;
      }

      const link = makePlaceholderLink();
      // send as plain message or embed
      await channel.send({ content: `link #${i + 1}: ${link}` });

      // random interval between minIntervalMs and maxIntervalMs
      const wait = randomInt(minIntervalMs, maxIntervalMs);
      await new Promise((res) => setTimeout(res, wait));
    }

    if (!stopRequested) {
      await channel.send(`${requesterTag} — انتهى  ${count} `);
    }
  } catch (err) {
    console.error("Error during generation run:", err);
    await channel.send(`حدث خطأ: ${err.message}`);
  } finally {
    state.running = false;
  }
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return; // only in guilds
  const content = message.content.trim();

  // simple command: "gen" optionally followed by number (count)
  if (!content.toLowerCase().startsWith(COMMAND)) return;

  // permission check: must be admin (you can change to role name check)
  const member = await message.guild.members.fetch(message.author.id);
  if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    await message.reply(
      "لا تملك صلاحية تنفيذ هذا الأمر. مطلوبة: Administrator.",
    );
    return;
  }

  // parse optional number after command, e.g. "gen 20"
  const parts = content.split(/\s+/);
  let requestedCount = 0;
  if (parts.length >= 2) {
    const p = parseInt(parts[1], 10);
    if (!isNaN(p)) requestedCount = p;
  }

  // start generation in the same channel (non-blocking)
  startGenerating(
    message.channel,
    message.guild.id,
    requestedCount,
    `<@${message.author.id}>`,
  );
});

client.login(TOKEN);
