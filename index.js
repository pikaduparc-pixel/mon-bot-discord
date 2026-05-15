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
  addXP,
  removeXP,
  getStats,
  xpForLevel,
  getLeaderboard,
  resetAll
} = require('./xp');

require('dotenv').config();
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1490689264990556289';
const GUILD_ID = '1302625108250333234';

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
const xpBoostMap = new Map();

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

// 📋 Définition des slash commands
const commands = [
  new SlashCommandBuilder().setName('bonjour').setDescription('Le bot te salue !'),
  new SlashCommandBuilder().setName('aide').setDescription('Affiche les commandes disponibles'),
  new SlashCommandBuilder().setName('rang').setDescription('Affiche ton rang ou celui d\'un membre')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre à consulter')),
  new SlashCommandBuilder().setName('lb').setDescription('Affiche le classement de la jungle'),
  new SlashCommandBuilder().setName('kick').setDescription('Expulse un membre')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre à kick').setRequired(true)),
  new SlashCommandBuilder().setName('ban').setDescription('Bannit un membre')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre à ban').setRequired(true)),
  new SlashCommandBuilder().setName('mute').setDescription('Mute un membre 10 minutes')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre à mute').setRequired(true)),
  new SlashCommandBuilder().setName('givexp').setDescription('Donne de l\'XP à un membre (admin)')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true))
    .addIntegerOption(opt => opt.setName('montant').setDescription('Montant d\'XP').setRequired(true)),
  new SlashCommandBuilder().setName('removexp').setDescription('Enlève de l\'XP à un membre (admin)')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true))
    .addIntegerOption(opt => opt.setName('montant').setDescription('Montant d\'XP').setRequired(true)),
  new SlashCommandBuilder().setName('xp2').setDescription('Active le XP x2 pour un membre (admin)')
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre').setRequired(true))
    .addIntegerOption(opt => opt.setName('duree').setDescription('Durée en minutes').setRequired(true)),
  new SlashCommandBuilder().setName('setup-ticket').setDescription('Envoie le panel de ticket (admin)'),
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

client.once('ready', async () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
    await connectDB();

  // 📋 Enregistrement des slash commands
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Slash commands enregistrées !');
  } catch (err) {
    console.error('Erreur enregistrement commands:', err);
  }

  // 🎤 XP vocal toutes les 5 minutes
  setInterval(async () => {
    for (const [userId] of voiceTracker) {
      const guild = client.guilds.cache.first();
      if (!guild) continue;
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;
      if (!member.voice.channel) { voiceTracker.delete(userId); continue; }
      if (member.voice.selfMute || member.voice.selfDeaf) continue;

      const voiceChannel = member.voice.channel;
      if (voiceChannel.name.toLowerCase().includes('afk')) continue;
      if (
        voiceChannel.parent?.name?.toLowerCase().includes('modérat') ||
        voiceChannel.parent?.name?.toLowerCase().includes('moderat')
      ) continue;

      let xpVocal = 30;
      if (xpBoostMap.has(userId) && xpBoostMap.get(userId) > Date.now()) xpVocal *= 2;

      const result = addXP(userId, member.displayName, xpVocal);
      await updateRoles(member, result.level);

      if (result.leveledUp) {
        const channel = guild.channels.cache.find(c => c.name === '⚡levels');
        if (channel) channel.send(`🎤 **${member.displayName}** vient de passer niveau **${result.level}** grâce au vocal ! 🎉`);
      }
    }
  }, 5 * 60 * 1000);

  // 🔄 Reset le 1er janvier
  setInterval(() => {
    const now = new Date();
    if (now.getMonth() === 0 && now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() === 0) {
      resetAll();
      const guild = client.guilds.cache.first();
      if (guild) {
        const channel = guild.channels.cache.find(c => c.name === 'général' || c.name === 'general');
        if (channel) channel.send('🔄 Bonne année ! Les XP et niveaux ont été remis à zéro ! 🎆');
      }
    }
  }, 60 * 1000);
});

// 🎤 Entrée / sortie vocal
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;
  if (!oldState.channelId && newState.channelId) voiceTracker.set(userId, Date.now());
  if (oldState.channelId && !newState.channelId) voiceTracker.delete(userId);
});

// 👋 Arrivée d'un membre
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

// 📩 XP écrit
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const now = Date.now();
  const lastMessage = cooldowns.get(message.author.id) || 0;
  if (now - lastMessage > 60 * 1000) {
    let xpGagné = Math.floor(Math.random() * 11) + 15;
    if (xpBoostMap.has(message.author.id) && xpBoostMap.get(message.author.id) > Date.now()) xpGagné *= 2;

    const result = addXP(message.author.id, message.member.displayName, xpGagné);
    cooldowns.set(message.author.id, now);

    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (member) await updateRoles(member, result.level);

    if (result.leveledUp) {
      const levelChannel = message.guild.channels.cache.find(c => c.name === '⚡levels');
      if (levelChannel) levelChannel.send(`🎉 Félicitations ${message.author} ! Tu passes au niveau **${result.level}** ! 🚀`);
    }
  }
});

// ⚡ Slash commands
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    // 📩 Créer un ticket
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
        c.name.toLowerCase() === 'ticket' &&
        c.type === ChannelType.GuildText &&
        (c.parent?.name?.toLowerCase() === 'modération' || c.parent?.name?.toLowerCase() === 'moderation')
      );
      if (modTicketChannel) modTicketChannel.send(`📋 Nouveau ticket créé par **${user.tag}** → ${ticketChannel}`);

      return interaction.reply({ content: `✅ Ton ticket a été créé : ${ticketChannel}`, ephemeral: true });
    }

    // 🔒 Fermer un ticket
    if (interaction.customId === 'close_ticket') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
        return interaction.reply({ content: '❌ Seuls les admins peuvent fermer un ticket.', ephemeral: true });
      await interaction.reply('🔒 Fermeture du ticket dans 5 secondes...');
      setTimeout(() => interaction.channel.delete().catch(err => console.error('Erreur suppression ticket:', err.message)), 5000);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // /bonjour
  if (commandName === 'bonjour') {
    return interaction.reply(`👋 Bonjour ${interaction.member.displayName} !`);
  }

  // /aide
  if (commandName === 'aide') {
    const embed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setTitle('📋 Commandes disponibles')
      .addFields(
        { name: '👋 Général', value: '`/bonjour` `/aide` `/rang` `/lb`' },
        { name: '🛡️ Modération (admin)', value: '`/kick` `/ban` `/mute`' },
        { name: '⭐ XP (admin)', value: '`/givexp` `/removexp` `/xp2`' },
        { name: '🎫 Ticket (admin)', value: '`/setup-ticket`' }
      );
    return interaction.reply({ embeds: [embed] });
  }

  // /rang
  if (commandName === 'rang') {
    const target = interaction.options.getUser('membre') || interaction.user;
    const stats = getStats(target.id);
    if (!stats) return interaction.reply(`❌ ${target.username} n'a pas encore d'XP !`);

    const nextLevelXP = xpForLevel(stats.level + 1);
    const percent = Math.min(Math.floor((stats.xp / nextLevelXP) * 100), 100);
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const displayName = member ? member.displayName : target.username;

    const embed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setAuthor({ name: displayName, iconURL: target.displayAvatarURL({ dynamic: true }) })
      .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '⭐ Niveau', value: `**${stats.level}**`, inline: true },
        { name: '✨ XP', value: `**${stats.xp}** / ${nextLevelXP}`, inline: true },
        { name: '📈 Progression', value: `**${percent}%** jusqu'au niveau ${stats.level + 1}`, inline: true }
      )
      .setFooter({ text: 'Jungle de singes 🐒' });

    return interaction.reply({ embeds: [embed] });
  }

  // /lb
  if (commandName === 'lb') {
    const top = getLeaderboard();
    if (!top.length) return interaction.reply('❌ Aucun classement pour l\'instant.');
    const medals = ['🥇', '🥈', '🥉'];
    const lines = await Promise.all(top.map(async ([id, data], i) => {
      const member = await interaction.guild.members.fetch(id).catch(() => null);
      const name = member ? member.displayName : data.username;
      return `${medals[i] || `${i + 1}.`} **${name}** — Niveau ${data.level} (${data.xp} XP)`;
    }));
    const embed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setTitle('🏆 Classement de la Jungle')
      .setDescription(lines.join('\n'));
    return interaction.reply({ embeds: [embed] });
  }

  // /kick
  if (commandName === 'kick') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return interaction.reply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });
    const member = interaction.options.getMember('membre');
    if (!member) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
    await member.kick().catch(err => interaction.reply(`❌ Erreur: ${err.message}`));
    return interaction.reply(`✅ ${member.user.tag} a été expulsé.`);
  }

  // /ban
  if (commandName === 'ban') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return interaction.reply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });
    const member = interaction.options.getMember('membre');
    if (!member) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
    await member.ban().catch(err => interaction.reply(`❌ Erreur: ${err.message}`));
    return interaction.reply(`✅ ${member.user.tag} a été banni.`);
  }

  // /mute
  if (commandName === 'mute') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return interaction.reply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });
    const member = interaction.options.getMember('membre');
    if (!member) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
    await member.timeout(10 * 60 * 1000).catch(err => interaction.reply(`❌ Erreur: ${err.message}`));
    return interaction.reply(`✅ ${member.user.tag} est mute pour 10 minutes.`);
  }

  // /givexp
  if (commandName === 'givexp') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });
    const target = interaction.options.getUser('membre');
    const amount = interaction.options.getInteger('montant');
    if (amount <= 0) return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });
    const result = addXP(target.id, target.displayName, amount);
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member) await updateRoles(member, result.level);
    return interaction.reply(`✅ **+${amount} XP** donné à ${target.displayName} ! (Total : ${result.xp} XP — Niveau ${result.level})`);
  }

  // /removexp
  if (commandName === 'removexp') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });
    const target = interaction.options.getUser('membre');
    const amount = interaction.options.getInteger('montant');
    if (amount <= 0) return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });
    const result = removeXP(target.id, amount);
    if (!result) return interaction.reply({ content: '❌ Cet utilisateur n\'a pas d\'XP.', ephemeral: true });
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member) await updateRoles(member, result.level);
    return interaction.reply(`✅ **-${amount} XP** retiré à ${target.displayName} ! (Total : ${result.xp} XP — Niveau ${result.level})`);
  }

  // /xp2
  if (commandName === 'xp2') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });
    const target = interaction.options.getUser('membre');
    const duration = interaction.options.getInteger('duree');
    if (duration <= 0) return interaction.reply({ content: '❌ Durée invalide.', ephemeral: true });
    xpBoostMap.set(target.id, Date.now() + duration * 60 * 1000);
    interaction.reply(`✅ XP x2 activé pour **${target.username}** pendant **${duration} minutes** ! ⚡`);
    setTimeout(() => {
      xpBoostMap.delete(target.id);
      interaction.channel.send(`⏰ XP x2 terminé pour **${target.username}** !`);
    }, duration * 60 * 1000);
    return;
  }

  // /setup-ticket
  if (commandName === 'setup-ticket') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setTitle('🎫 Créer un ticket')
      .setDescription('Tu as besoin d\'aide ? Clique sur le bouton ci-dessous pour ouvrir un ticket avec l\'équipe.');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('create_ticket').setLabel('📩 Créer un ticket').setStyle(ButtonStyle.Secondary)
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Panel ticket envoyé !', ephemeral: true });
  }
});

client.login(TOKEN);
// Serveur HTTP pour garder Render actif
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot en ligne !');
});
server.listen(process.env.PORT || 3000);
