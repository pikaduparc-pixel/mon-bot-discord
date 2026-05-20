const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder,
  Collection
} = require('discord.js');

const {
  connectDB,
  runMigration,
  addXP,
  removeXP,
  getStats,
  xpForLevel,
  getLeaderboard,
  resetAll
} = require('./xp');

require('dotenv').config();
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

const cooldowns = new Map();
const voiceTracker = new Map();

const ROLE_LEVELS = [
  { level: 1,   name: '🐒 Bébé Singe' },
  { level: 10,  name: '🐵 Ptit Singe' },
  { level: 20,  name: '🍌 Voleur de Banane' },
  { level: 30,  name: '💪 Maxi Singe' },
  { level: 45,  name: '😐 Singe Lugubresque' },
  { level: 60,  name: '🦫 Père Castor' },
  { level: 75,  name: '🌳 Pull Up Pas L\'Arbre' },
  { level: 90,  name: '💀 Puant Originel' },
  { level: 100, name: '👑 Roi des Singes' },
];

async function updateRoles(member, level) {
  for (const roleData of ROLE_LEVELS) {
    const role = member.guild.roles.cache.find(r => r.name === roleData.name);
    if (!role) continue;
    try {
      if (level >= roleData.level) {
        if (!member.roles.cache.has(role.id)) await member.roles.add(role);
      } else {
        if (member.roles.cache.has(role.id)) await member.roles.remove(role);
      }
    } catch (err) {
      console.error(`Erreur rôle ${roleData.name}:`, err.message);
    }
  }
}

// ─── ENREGISTREMENT DES SLASH COMMANDS ───────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('aide')
    .setDescription('Affiche la liste des commandes'),

  new SlashCommandBuilder()
    .setName('rang')
    .setDescription('Affiche ton rang ou celui d\'un membre')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre à consulter').setRequired(false)),

  new SlashCommandBuilder()
    .setName('classement')
    .setDescription('Affiche le top 10 du serveur'),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulse un membre')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre à expulser').setRequired(true))
    .addStringOption(opt => opt.setName('raison').setDescription('Raison').setRequired(false))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannit un membre')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre à bannir').setRequired(true))
    .addStringOption(opt => opt.setName('raison').setDescription('Raison').setRequired(false))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Rend muet un membre pendant 10 minutes')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre à mute').setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),

  new SlashCommandBuilder()
    .setName('givexp')
    .setDescription('Donne de l\'XP à un membre')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true))
    .addIntegerOption(opt => opt.setName('montant').setDescription('Quantité d\'XP').setRequired(true).setMinValue(1))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName('removexp')
    .setDescription('Retire de l\'XP à un membre')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true))
    .addIntegerOption(opt => opt.setName('montant').setDescription('Quantité d\'XP').setRequired(true).setMinValue(1))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('Installe le panneau de tickets')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName('migrate')
    .setDescription('Restaure les données des membres')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
].map(cmd => cmd.toJSON());

async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('🔄 Enregistrement des slash commands...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Slash commands enregistrées !');
  } catch (err) {
    console.error('❌ Erreur enregistrement commands:', err);
  }
}

// ─── READY ────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
  await connectDB();
  await deployCommands();

  // XP vocal toutes les 5 minutes
  setInterval(async () => {
    for (const [userId] of voiceTracker) {
      const guild = client.guilds.cache.first();
      if (!guild) continue;
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;
      if (!member.voice.channel) { voiceTracker.delete(userId); continue; }
      if (member.voice.selfMute || member.voice.selfDeaf) continue;
      const result = await addXP(userId, member.user.username, 30);
      await updateRoles(member, result.level);
      if (result.leveledUp) {
        const channel = guild.channels.cache.find(c => c.name === '⚡levels');
        if (channel) channel.send(`🎤 **${member.user.username}** vient de passer niveau **${result.level}** grâce au vocal ! 🎉`);
      }
    }
  }, 5 * 60 * 1000);

  // Reset annuel
  setInterval(async () => {
    const now = new Date();
    if (now.getMonth() === 0 && now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() === 0) {
      await resetAll();
      const guild = client.guilds.cache.first();
      if (guild) {
        const channel = guild.channels.cache.find(c => c.name === 'général' || c.name === 'general');
        if (channel) channel.send('🔄 Bonne année ! Les XP et niveaux ont été remis à zéro ! 🎆');
      }
    }
  }, 60 * 1000);
});

// ─── VOICE ────────────────────────────────────────────────────────────────────
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;
  if (!oldState.channelId && newState.channelId) voiceTracker.set(userId, Date.now());
  if (oldState.channelId && !newState.channelId) voiceTracker.delete(userId);
});

// ─── WELCOME ──────────────────────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  const roleNames = ['Membre', '🐒 Bébé Singe'];
  for (const name of roleNames) {
    const role = member.guild.roles.cache.find(r => r.name === name);
    if (role) await member.roles.add(role).catch(err => console.error(`Erreur auto-rôle ${name}:`, err.message));
  }
  const channel = member.guild.channels.cache.find(c => c.name === 'arrivé');
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setColor(0x2C2F33)
    .setTitle(`👋 Bienvenue sur ${member.guild.name} !`)
    .setDescription(`Bienvenue ${member} ! Tu es le **${member.guild.memberCount}ème** membre du serveur ! 🎉`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({ text: 'Bonne arrivée parmi nous !' })
    .setTimestamp();
  channel.send({ embeds: [embed] });
});

// ─── XP PAR MESSAGE ───────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const now = Date.now();
  const lastMessage = cooldowns.get(message.author.id) || 0;
  if (now - lastMessage > 60 * 1000) {
    const xpGagné = Math.floor(Math.random() * 11) + 15;
    const result = await addXP(message.author.id, message.author.username, xpGagné);
    cooldowns.set(message.author.id, now);
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (member) await updateRoles(member, result.level);
    if (result.leveledUp) {
      const levelChannel = message.guild.channels.cache.find(c => c.name === '⚡levels');
      if (levelChannel) levelChannel.send(`🎉 Félicitations ${message.author} ! Tu passes au niveau **${result.level}** ! 🚀`);
    }
  }
});

// ─── SLASH COMMANDS ───────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── BOUTONS ────────────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    if (interaction.customId === 'create_ticket') {
      const guild = interaction.guild;
      const user = interaction.user;
      const existing = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase()}`);
      if (existing) return interaction.reply({ content: `❌ Tu as déjà un ticket ouvert : ${existing}`, ephemeral: true });
      const adminRole = guild.roles.cache.find(r => r.name === 'Admin');
      const ticketCategory = guild.channels.cache.find(c => c.name.toLowerCase() === 'ticket' && c.type === ChannelType.GuildCategory);
      const ticketChannel = await guild.channels.create({
        name: `ticket-${user.username.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: ticketCategory?.id || null,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          ...(adminRole ? [{ id: adminRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }] : [])
        ]
      }).catch(err => { console.error('Erreur création ticket:', err.message); return null; });
      if (!ticketChannel) return interaction.reply({ content: '❌ Erreur lors de la création du ticket.', ephemeral: true });
      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Fermer le ticket').setStyle(ButtonStyle.Danger)
      );
      const ticketEmbed = new EmbedBuilder()
        .setColor(0x2C2F33)
        .setTitle(`🎫 Ticket de ${user.username}`)
        .setDescription(`Bonjour ${user} ! L'équipe va te répondre rapidement.\nExplique ton problème ci-dessous.`)
        .setTimestamp();
      await ticketChannel.send({ embeds: [ticketEmbed], components: [closeRow] });
      const modTicketChannel = guild.channels.cache.find(c =>
        c.name.toLowerCase() === 'ticket' && c.type === ChannelType.GuildText &&
        (c.parent?.name?.toLowerCase() === 'modération' || c.parent?.name?.toLowerCase() === 'moderation')
      );
      if (modTicketChannel) modTicketChannel.send(`📋 Nouveau ticket créé par **${user.tag}** → ${ticketChannel}`);
      return interaction.reply({ content: `✅ Ton ticket a été créé : ${ticketChannel}`, ephemeral: true });
    }

    if (interaction.customId === 'close_ticket') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
        return interaction.reply({ content: '❌ Seuls les admins peuvent fermer un ticket.', ephemeral: true });
      await interaction.reply('🔒 Fermeture du ticket dans 5 secondes...');
      setTimeout(() => interaction.channel.delete().catch(err => console.error('Erreur suppression ticket:', err.message)), 5000);
    }
    return;
  }

  // ── COMMANDES ──────────────────────────────────────────────────────────────
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  // /aide
  if (commandName === 'aide') {
    const embed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setTitle('📋 Commandes disponibles')
      .addFields(
        { name: '👋 Général', value: '`/aide` `/rang` `/classement`' },
        { name: '🛡️ Modération (admin)', value: '`/kick` `/ban` `/mute`' },
        { name: '⭐ XP (admin)', value: '`/givexp` `/removexp`' },
        { name: '🎫 Ticket (admin)', value: '`/setup-ticket`' }
      );
    return interaction.reply({ embeds: [embed] });
  }

  // /rang
  if (commandName === 'rang') {
    const target = interaction.options.getUser('membre') || interaction.user;
    const stats = await getStats(target.id);
    if (!stats) return interaction.reply({ content: `❌ ${target.username} n'a pas encore d'XP !`, ephemeral: true });
    const nextLevelXP = xpForLevel(stats.level + 1);
    const percent = Math.min(Math.floor((stats.xp / nextLevelXP) * 100), 100);
    const embed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setTitle(`📊 Rang de ${stats.username}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '⭐ Niveau', value: `**${stats.level}**`, inline: true },
        { name: '✨ XP', value: `**${stats.xp}** / ${nextLevelXP} XP`, inline: true },
        { name: '📈 Progression', value: `**${percent}%** vers le niveau suivant` }
      );
    return interaction.reply({ embeds: [embed] });
  }

  // /classement
  if (commandName === 'classement') {
    const top = await getLeaderboard();
    if (!top.length) return interaction.reply({ content: '❌ Aucun classement pour l\'instant.', ephemeral: true });
    const medals = ['🥇', '🥈', '🥉'];
    const lines = top.map(([id, data], i) =>
      `${medals[i] || `${i + 1}.`} **${data.username}** — Niveau ${data.level} (${data.xp} XP)`
    );
    const embed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setTitle('🏆 Classement du serveur')
      .setDescription(lines.join('\n'));
    return interaction.reply({ embeds: [embed] });
  }

  // /kick
  if (commandName === 'kick') {
    const member = interaction.options.getMember('membre');
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';
    if (!member) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
    await member.kick(raison).catch(err => interaction.reply({ content: `❌ Erreur: ${err.message}`, ephemeral: true }));
    return interaction.reply({ content: `✅ **${member.user.tag}** a été expulsé. Raison : ${raison}` });
  }

  // /ban
  if (commandName === 'ban') {
    const member = interaction.options.getMember('membre');
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';
    if (!member) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
    await member.ban({ reason: raison }).catch(err => interaction.reply({ content: `❌ Erreur: ${err.message}`, ephemeral: true }));
    return interaction.reply({ content: `✅ **${member.user.tag}** a été banni. Raison : ${raison}` });
  }

  // /mute
  if (commandName === 'mute') {
    const member = interaction.options.getMember('membre');
    if (!member) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
    await member.timeout(10 * 60 * 1000).catch(err => interaction.reply({ content: `❌ Erreur: ${err.message}`, ephemeral: true }));
    return interaction.reply({ content: `✅ **${member.user.tag}** est mute pour 10 minutes.` });
  }

  // /givexp
  if (commandName === 'givexp') {
    const target = interaction.options.getUser('membre');
    const amount = interaction.options.getInteger('montant');
    const result = await addXP(target.id, target.username, amount);
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member) await updateRoles(member, result.level);
    return interaction.reply({ content: `✅ **+${amount} XP** donné à ${target.username} ! (Total : ${result.xp} XP — Niveau ${result.level})` });
  }

  // /removexp
  if (commandName === 'removexp') {
    const target = interaction.options.getUser('membre');
    const amount = interaction.options.getInteger('montant');
    const result = await removeXP(target.id, amount);
    if (!result) return interaction.reply({ content: '❌ Cet utilisateur n\'a pas d\'XP.', ephemeral: true });
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member) await updateRoles(member, result.level);
    return interaction.reply({ content: `✅ **-${amount} XP** retiré à ${target.username} ! (Total : ${result.xp} XP — Niveau ${result.level})` });
  }

  // /setup-ticket
  if (commandName === 'setup-ticket') {
    const embed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setTitle('🎫 Créer un ticket')
      .setDescription('Tu as besoin d\'aide ? Clique sur le bouton ci-dessous pour ouvrir un ticket avec l\'équipe.');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('create_ticket').setLabel('📩 Créer un ticket').setStyle(ButtonStyle.Secondary)
    );
    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Panneau de tickets installé !', ephemeral: true });
  }

  // /migrate
  if (commandName === 'migrate') {
    await interaction.reply({ content: '⏳ Migration en cours...', ephemeral: true });
    await runMigration();
    return interaction.editReply({ content: '✅ Migration terminée ! 16 membres restaurés.' });
  }
});

// ─── SERVEUR HTTP (pour Railway) ──────────────────────────────────────────────
const http = require('http');
http.createServer((req, res) => { res.writeHead(200); res.end('Bot en ligne !'); })
  .listen(process.env.PORT || 3000);

client.login(TOKEN);