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
  SlashCommandBuilder
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

const {
  handleMusicButton,
  handlePlayCommand,
  handleSkipCommand,
  handleStopCommand,
  handleQueueCommand,
  handleNowPlayingCommand,
  handlePauseCommand,
  handleLoopCommand
} = require('./music-handler');

require('dotenv').config();
const TOKEN = process.env.DISCORD_TOKEN;

try { process.env.FFMPEG_PATH = require('ffmpeg-static'); } catch (e) {}

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

// ─── Définition de toutes les slash commands ───
const commands = [
  new SlashCommandBuilder().setName('bonjour').setDescription('Saluer le bot'),
  new SlashCommandBuilder().setName('aide').setDescription('Afficher les commandes disponibles'),
  new SlashCommandBuilder()
    .setName('rang')
    .setDescription('Voir ton rang ou celui d\'un membre')
    .addUserOption(opt => opt.setName('membre').setDescription('Membre à consulter').setRequired(false)),
  new SlashCommandBuilder().setName('classement').setDescription('Voir le classement du serveur'),

  // Musique
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Jouer une chanson dans le vocal')
    .addStringOption(opt => opt.setName('chanson').setDescription('Nom ou lien YouTube').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Passer à la chanson suivante'),
  new SlashCommandBuilder().setName('stop').setDescription('Arrêter la musique et vider la queue'),
  new SlashCommandBuilder().setName('pause').setDescription('Mettre en pause / reprendre'),
  new SlashCommandBuilder().setName('queue').setDescription('Afficher la file d\'attente'),
  new SlashCommandBuilder().setName('np').setDescription('Voir la chanson en cours'),
  new SlashCommandBuilder().setName('loop').setDescription('Activer/désactiver la boucle'),

  // Modération
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulser un membre')
    .addUserOption(opt => opt.setName('membre').setDescription('Membre à expulser').setRequired(true))
    .addStringOption(opt => opt.setName('raison').setDescription('Raison').setRequired(false)),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannir un membre')
    .addUserOption(opt => opt.setName('membre').setDescription('Membre à bannir').setRequired(true))
    .addStringOption(opt => opt.setName('raison').setDescription('Raison').setRequired(false)),
  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mettre un membre en timeout 10 minutes')
    .addUserOption(opt => opt.setName('membre').setDescription('Membre à muter').setRequired(true)),

  // XP admin
  new SlashCommandBuilder()
    .setName('givexp')
    .setDescription('Donner de l\'XP à un membre')
    .addUserOption(opt => opt.setName('membre').setDescription('Membre').setRequired(true))
    .addIntegerOption(opt => opt.setName('montant').setDescription('Quantité d\'XP').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder()
    .setName('removexp')
    .setDescription('Retirer de l\'XP à un membre')
    .addUserOption(opt => opt.setName('membre').setDescription('Membre').setRequired(true))
    .addIntegerOption(opt => opt.setName('montant').setDescription('Quantité d\'XP').setRequired(true).setMinValue(1)),

  // Admin
  new SlashCommandBuilder().setName('admin-migrate').setDescription('Restaurer les données XP (admin)'),
  new SlashCommandBuilder().setName('setup-ticket').setDescription('Créer le panneau de tickets (admin)'),
].map(cmd => cmd.toJSON());

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

async function registerCommands(guild) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
  console.log(`✅ Commandes enregistrées sur ${guild.name}`);
}

client.once('ready', async () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
  await connectDB();

  // Les commandes sont enregistrées sur chaque serveur où le bot est présent.
  try {
    await Promise.all(client.guilds.cache.map(registerCommands));
  } catch (err) {
    console.error('Erreur d’enregistrement des commandes:', err.message);
  }

  // XP vocal toutes les 5 minutes
  setInterval(async () => {
    for (const [userId] of voiceTracker) {
      const guild = client.guilds.cache.first();
      if (!guild) continue;
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;
      if (!member.voice.channel) { voiceTracker.delete(userId); continue; }
      if (member.voice.selfMute || member.voice.selfDeaf) continue;
      const result = await addXP(userId, member.user.username, 10);
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
        if (channel) channel.send('🔄 Bonne année ! Les XP ont été remis à zéro ! 🎆');
      }
    }
  }, 60 * 1000);
});

// Vocal tracking
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;
  if (!oldState.channelId && newState.channelId) voiceTracker.set(userId, Date.now());
  if (oldState.channelId && !newState.channelId) voiceTracker.delete(userId);
});

// Enregistre immédiatement les commandes quand le bot rejoint un nouveau serveur.
client.on('guildCreate', guild => {
  registerCommands(guild).catch(err => console.error(`Erreur commandes sur ${guild.name}:`, err.message));
});

// Bienvenue
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
    .setDescription(`Bienvenue ${member} ! Tu es le **${member.guild.memberCount}ème** membre ! 🎉`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({ text: 'Bonne arrivée parmi nous !' })
    .setTimestamp();
  channel.send({ embeds: [embed] });
});

// XP messages (pas de commandes en prefix)
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const now = Date.now();
  const lastMessage = cooldowns.get(message.author.id) || 0;
  if (now - lastMessage > 60 * 1000) {
    const xpGagné = Math.floor(Math.random() * 6) + 5;
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

// ─── Toutes les interactions ───
client.on('interactionCreate', async (interaction) => {

  // ── Boutons musique ──
  if (interaction.isButton() && interaction.customId.startsWith('music_')) {
    return handleMusicButton(interaction);
  }

  // ── Boutons tickets ──
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
      }).catch(err => { console.error('Erreur ticket:', err.message); return null; });
      if (!ticketChannel) return interaction.reply({ content: '❌ Erreur création ticket.', ephemeral: true });
      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Fermer le ticket').setStyle(ButtonStyle.Danger)
      );
      await ticketChannel.send({
        embeds: [new EmbedBuilder().setColor(0x2C2F33).setTitle(`🎫 Ticket de ${user.username}`).setDescription(`Bonjour ${user} ! Explique ton problème ci-dessous.`).setTimestamp()],
        components: [closeRow]
      });
      return interaction.reply({ content: `✅ Ticket créé : ${ticketChannel}`, ephemeral: true });
    }

    if (interaction.customId === 'close_ticket') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
        return interaction.reply({ content: '❌ Admins seulement.', ephemeral: true });
      await interaction.reply('🔒 Fermeture dans 5 secondes...');
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
    return;
  }

  // ── Slash commands ──
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction.commandName;

  // /bonjour
  if (cmd === 'bonjour') {
    return interaction.reply(`👋 Bonjour ${interaction.user.username} !`);
  }

  // /aide
  if (cmd === 'aide') {
    const embed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setTitle('📋 Commandes disponibles')
      .addFields(
        { name: '👋 Général', value: '`/bonjour` `/aide` `/rang` `/classement`' },
        { name: '🎵 Musique', value: '`/play` `/skip` `/stop` `/pause` `/queue` `/np` `/loop`' },
        { name: '🛡️ Modération', value: '`/kick` `/ban` `/mute`' },
        { name: '⭐ XP (admin)', value: '`/givexp` `/removexp`' },
        { name: '🎫 Tickets (admin)', value: '`/setup-ticket`' }
      );
    return interaction.reply({ embeds: [embed] });
  }

  // /rang
  if (cmd === 'rang') {
    const target = interaction.options.getUser('membre') || interaction.user;
    const stats = await getStats(target.id);
    if (!stats) return interaction.reply({ content: `❌ ${target.username} n'a pas encore d'XP !`, ephemeral: true });
    const nextLevelXP = xpForLevel(stats.level + 1);
    const progress = Math.min(Math.floor((stats.xp / nextLevelXP) * 20), 20);
    const bar = '█'.repeat(progress) + '░'.repeat(20 - progress);
    const embed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setTitle(`📊 Rang de ${stats.username}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '⭐ Niveau', value: `**${stats.level}**`, inline: true },
        { name: '✨ XP', value: `**${stats.xp}** / ${nextLevelXP} XP`, inline: true },
        { name: '📈 Progression', value: `\`[${bar}]\`` }
      );
    return interaction.reply({ embeds: [embed] });
  }

  // /classement
  if (cmd === 'classement') {
    const top = await getLeaderboard();
    if (!top.length) return interaction.reply({ content: '❌ Aucun classement.', ephemeral: true });
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

  // ── Musique ──
  if (cmd === 'play') {
    const args = [interaction.options.getString('chanson')];
    return handlePlayCommand(interaction, args);
  }
  if (cmd === 'skip') return handleSkipCommand(interaction);
  if (cmd === 'stop') return handleStopCommand(interaction);
  if (cmd === 'queue') return handleQueueCommand(interaction);
  if (cmd === 'np') return handleNowPlayingCommand(interaction);
  if (cmd === 'pause') return handlePauseCommand(interaction);
  if (cmd === 'loop') return handleLoopCommand(interaction);

  // ── Modération ──
  if (cmd === 'kick') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return interaction.reply({ content: '❌ Permission refusée.', ephemeral: true });
    const member = interaction.options.getMember('membre');
    if (!member) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
    await member.kick().catch(err => interaction.reply({ content: `❌ Erreur: ${err.message}`, ephemeral: true }));
    return interaction.reply(`✅ **${member.user.tag}** a été expulsé.`);
  }

  if (cmd === 'ban') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return interaction.reply({ content: '❌ Permission refusée.', ephemeral: true });
    const member = interaction.options.getMember('membre');
    if (!member) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
    await member.ban().catch(err => interaction.reply({ content: `❌ Erreur: ${err.message}`, ephemeral: true }));
    return interaction.reply(`✅ **${member.user.tag}** a été banni.`);
  }

  if (cmd === 'mute') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return interaction.reply({ content: '❌ Permission refusée.', ephemeral: true });
    const member = interaction.options.getMember('membre');
    if (!member) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
    await member.timeout(10 * 60 * 1000).catch(err => interaction.reply({ content: `❌ Erreur: ${err.message}`, ephemeral: true }));
    return interaction.reply(`✅ **${member.user.tag}** est mute pour 10 minutes.`);
  }

  // ── XP admin ──
  if (cmd === 'givexp') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: '❌ Admins seulement.', ephemeral: true });
    const target = interaction.options.getUser('membre');
    const amount = interaction.options.getInteger('montant');
    const result = await addXP(target.id, target.username, amount);
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member) await updateRoles(member, result.level);
    return interaction.reply(`✅ **+${amount} XP** donné à ${target.username} ! (Total : ${result.xp} XP — Niveau ${result.level})`);
  }

  if (cmd === 'removexp') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: '❌ Admins seulement.', ephemeral: true });
    const target = interaction.options.getUser('membre');
    const amount = interaction.options.getInteger('montant');
    const result = await removeXP(target.id, amount);
    if (!result) return interaction.reply({ content: '❌ Aucun XP trouvé.', ephemeral: true });
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member) await updateRoles(member, result.level);
    return interaction.reply(`✅ **-${amount} XP** retiré à ${target.username} ! (Total : ${result.xp} XP — Niveau ${result.level})`);
  }

  // ── Admin migrate ──
  if (cmd === 'admin-migrate') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: '❌ Admins seulement.', ephemeral: true });
    await interaction.reply('⏳ Migration en cours...');
    await runMigration();
    return interaction.editReply('✅ Migration terminée ! 16 membres restaurés.');
  }

  // ── Setup ticket ──
  if (cmd === 'setup-ticket') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: '❌ Admins seulement.', ephemeral: true });
    const embed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setTitle('🎫 Créer un ticket')
      .setDescription('Clique sur le bouton ci-dessous pour ouvrir un ticket avec l\'équipe.');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('create_ticket').setLabel('📩 Créer un ticket').setStyle(ButtonStyle.Secondary)
    );
    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Panneau créé !', ephemeral: true });
  }
});

client.login(TOKEN);

const http = require('http');
http.createServer((req, res) => { res.writeHead(200); res.end('Bot en ligne !'); })
  .listen(process.env.PORT || 3000);
