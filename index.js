
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.BOT_TOKEN; 
const PREFIX = ''; 
const COMMAND = 'gen';
const STOP_COMMAND = 'stop';

if (!TOKEN) {
  console.error('Please set BOT_TOKEN in .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, 
  ],
  partials: [Partials.Channel],
  allowedMentions: { 
    parse: ['everyone', 'users', 'roles'] 
  }
});


const maxMessagesPerRun = 99999999999;         
const cooldownBetweenRuns = 5 * 60 * 50;      
const minIntervalMs = 500;
const maxIntervalMs = 500;  


const guildState = new Map(); 

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


function makePlaceholderLink() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  // طول عشوائي بين 16 و 24 حرف (مثل روابط النيترو الحقيقية)
  const codeLength = randomInt(16, 24);
  for (let i = 0; i < codeLength; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

  return `https://discord.gift/${code}`;
}


async function checkNitroCode(code) {
  try {
    const fetch = (await import('node-fetch')).default;
    const url = `https://discord.com/api/v9/entitlements/gift-codes/${code}`;
    const response = await fetch(url);
    
  
    return response.status === 200;
  } catch (error) {
    console.error('Error checking code:', error);
    return false;
  }
}

async function startGenerating(channel, guildId, requestedCount, requesterTag) {
  if (!guildState.has(guildId)) guildState.set(guildId, { lastRun: 0, running: false, stopRequested: false });

  const state = guildState.get(guildId);

  const now = Date.now();
  if (state.running) {
    await channel.send(`${requesterTag} —  الرجاء الانتظار .`);
    return;
  }
  if (now - state.lastRun < cooldownBetweenRuns) {
    const remaining = Math.ceil((cooldownBetweenRuns - (now - state.lastRun)) / 1000);
    await channel.send(`${requesterTag} — لا يمكنك البدء الآن. انتظر ${remaining} ثانية قبل المحاولة مرة أخرى.`);
    return;
  }

  
  const count = Math.min(Math.max(1, requestedCount || 10), maxMessagesPerRun);

  state.running = true;
  state.lastRun = now;
  state.stopRequested = false;

  const startEmbed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('🚀 بدء عملية التوليد')
    .setDescription(`جاري إرسال **${count}** رابط نيترو...`)
    .addFields(
      { name: '⏹️ للإيقاف', value: 'اكتب `stop` في أي وقت', inline: true },
      { name: '✅ الحالة', value: 'قيد التشغيل', inline: true }
    )
    .setTimestamp();

  await channel.send({ content: requesterTag, embeds: [startEmbed] });

  try {

 
    for (let i = 0; i < count; i++) {
      if (state.stopRequested) {
        const stopEmbed = new EmbedBuilder()
          .setColor('#ED4245')
          .setTitle('⏹️ تم إيقاف العملية')
          .setDescription(`تم إيقاف العملية بعد إرسال **${i}** رابط.`)
          .setTimestamp();
        
        await channel.send({ content: requesterTag, embeds: [stopEmbed] });
        break;
      }

      const link = makePlaceholderLink();
      const code = link.replace('https://discord.gift/', '');
      
     
      const isValid = await checkNitroCode(code);
      
      if (isValid) {
      
        const validEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(' تم العثور على رابط نيترو صحيح! ')
          .setDescription(`**الرابط:** ${link}`)
          .addFields(
            { name: '🔢 رقم الرابط', value: `#${i+1}`, inline: true },
            { name: '✅ الحالة', value: 'صحيح ومتاح', inline: true }
          )
          .setTimestamp();
        
        await channel.send({ 
          content: '@everyone',
          embeds: [validEmbed],
          allowedMentions: { parse: ['everyone'] }
        });
        console.log(`✅ Valid code found: ${code}`);
      } else {
       
        await channel.send({ content: `link #${i+1}: ${link}` });
      }

     
      const wait = randomInt(minIntervalMs, maxIntervalMs);
      await new Promise(res => setTimeout(res, wait));
    }

    if (!state.stopRequested) {
      const finishEmbed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ اكتملت العملية بنجاح')
        .setDescription(`تم إرسال **${count}** رابط بنجاح.`)
        .setTimestamp();
      
      await channel.send({ content: requesterTag, embeds: [finishEmbed] });
    }
  } catch (err) {
    console.error('Error during generation run:', err);
    await channel.send(`حدث خطأ: ${err.message}`);
  } finally {
    state.running = false;
  }
}

client.on('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});


client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  
  if (interaction.customId === 'link_count_select') {
    const selectedCount = parseInt(interaction.values[0]);
    
    await interaction.update({
      content: `✅ تم اختيار **${selectedCount}** رابط. جاري البدء...`,
      components: []
    });
    
    startGenerating(
      interaction.channel,
      interaction.guild.id,
      selectedCount,
      `<@${interaction.user.id}>`
    );
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return; 
  const content = message.content.trim().toLowerCase();


  if (content === STOP_COMMAND) {
    const member = await message.guild.members.fetch(message.author.id);
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      await message.reply('لا تملك صلاحية تنفيذ هذا الأمر.');
      return;
    }
    
    const state = guildState.get(message.guild.id);
    if (state && state.running) {
      state.stopRequested = true;
      await message.reply('✅ تم طلب إيقاف العملية. سيتم الإيقاف بعد الرابط الحالي.');
    } else {
      await message.reply('❌ لا توجد عملية قيد التشغيل حالياً.');
    }
    return;
  }

 
  if (!content.startsWith(COMMAND)) return;

  
  const member = await message.guild.members.fetch(message.author.id);
  if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    await message.reply('لا تملك صلاحية تنفيذ هذا الأمر. مطلوبة: Administrator.');
    return;
  }


  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(' مولد روابط النيترو')
    .setDescription('اختر عدد الروابط التي تريد إرسالها:')
    .addFields(
      { name: '📊 الخيارات المتاحة', value: '100 - 500 - 1000 - 2500 - 5000 رابط' },
      { name: '⏹️ الإيقاف', value: 'اكتب `stop` لإيقاف العملية في أي وقت' }
    )
    .setFooter({ text: 'سيتم التحقق من كل رابط تلقائياً' })
    .setTimestamp();

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('link_count_select')
    .setPlaceholder('اختر عدد الروابط...')
    .addOptions([
      new StringSelectMenuOptionBuilder()
        .setLabel('100 رابط')
        .setDescription('إرسال 100 رابط نيترو')
        .setValue('100')
        .setEmoji('1️⃣'),
      new StringSelectMenuOptionBuilder()
        .setLabel('500 رابط')
        .setDescription('إرسال 500 رابط نيترو')
        .setValue('500')
        .setEmoji('2️⃣'),
      new StringSelectMenuOptionBuilder()
        .setLabel('1000 رابط')
        .setDescription('إرسال 1000 رابط نيترو')
        .setValue('1000')
        .setEmoji('3️⃣'),
      new StringSelectMenuOptionBuilder()
        .setLabel('2500 رابط')
        .setDescription('إرسال 2500 رابط نيترو')
        .setValue('2500')
        .setEmoji('4️⃣'),
      new StringSelectMenuOptionBuilder()
        .setLabel('5000 رابط')
        .setDescription('إرسال 5000 رابط نيترو')
        .setValue('5000')
        .setEmoji('5️⃣')
     new StringSelectMenuOptionBuilder()
        .setLabel('10000 رابط')
        .setDescription('إرسال 10000 رابط نيترو')
        .setValue('10000')
        .setEmoji('6️⃣')
     new StringSelectMenuOptionBuilder()
        .setLabel('25000 رابط')
        .setDescription('إرسال 50002 رابط نيترو')
        .setValue('25000')
        .setEmoji('7️⃣')
     new StringSelectMenuOptionBuilder()
        .setLabel('50000 رابط')
        .setDescription('إرسال 50000 رابط نيترو')
        .setValue('50000')
        .setEmoji('8️⃣')
     new StringSelectMenuOptionBuilder()
        .setLabel('10000 رابط')
        .setDescription('إرسال 10000 رابط نيترو')
        .setValue('100000')
        .setEmoji('9️⃣')
new StringSelectMenuOptionBuilder()
        .setLabel('500000 رابط')
        .setDescription('إرسال 500000 رابط نيترو')
        .setValue('500000')
        .setEmoji('🔟')
    ]);

  const row = new ActionRowBuilder()
    .addComponents(selectMenu);

  await message.reply({
    embeds: [embed],
    components: [row]
  });
});

client.login(TOKEN);