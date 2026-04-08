const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');

const {
  addXP,
  removeXP,
  getStats,
  xpForLevel,
  getLeaderboard,
  resetAll
} = require('./xp');

const TOKEN = 'MTQ5MDY4OTI2NDk5MDU1NjI4OQ.GiJhMX.5o8eOUA0M4CSN_SHKLGr7dT0JzOsgOz5-HI6WQ'; // 🔑 Remplace par ton token

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

// ⏱️ Cooldown XP écrit
const cooldowns = new Map();

// 🎤 Suivi vocal
const voiceTracker = new Map();

// 🎭 Rôles par niveau
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

// 🎭 Mettre à jour les rôles selon le niveau
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

// ✅ Bot prêt
client.once('ready', () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);

  // 🎤 XP vocal toutes les 5 minutes
  setInterval(async () => {
    for (const [userId] of voiceTracker) {
      const guild = client.guilds.cache.first();
      if (!guild) continue;

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;
      if (!member.voice.channel) { voiceTracker.delete(userId); continue; }
      if (member.voice.selfMute || member.voice.selfDeaf) continue;

      const result = addXP(userId, member.user.username, 30);
      await updateRoles(member, result.level);

      if (result.leveledUp) {
        const channel = guild.channels.cache.find(
  c => c.name === '⚡levels'
);
        if (channel) {
          channel.send(
            `🎤 **${member.user.username}** vient de passer niveau **${result.level}** grâce au vocal ! 🎉`
          );
        }
      }
    }
  }, 5 * 60 * 1000);

  // 🔄 Reset automatique le 1er janvier à minuit
  setInterval(() => {
    const now = new Date();
    if (
      now.getMonth() === 0 &&
      now.getDate() === 1 &&
      now.getHours() === 0 &&
      now.getMinutes() === 0
    ) {
      resetAll();
      const guild = client.guilds.cache.first();
      if (guild) {
        const channel = guild.channels.cache.find(
          c => c.name === 'général' || c.name === 'general'
        );
        if (channel) {
          channel.send('🔄 Bonne année ! Les XP et niveaux ont été remis à zéro ! 🎆');
        }
      }
    }
  }, 60 * 1000);
});

// 🎤 Entrée / sortie vocal
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;
  if (!oldState.channelId && newState.channelId) {
    voiceTracker.set(userId, Date.now());
  }
  if (oldState.channelId && !newState.channelId) {
    voiceTracker.delete(userId);
  }
});

// 👋 Arrivée d'un membre
client.on('guildMemberAdd', async (member) => {
  // Auto-rôles
  const roleNames = ['Membre', '🐒 Bébé Singe'];
  for (const name of roleNames) {
    const role = member.guild.roles.cache.find(r => r.name === name);
    if (role) {
      await member.roles.add(role).catch(err =>
        console.error(`Erreur auto-rôle ${name}:`, err.message)
      );
    }
  }

  // Message de bienvenue
  const channel = member.guild.channels.cache.find(c => c.name === 'arrivé');
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0x2C2F33)
    .setTitle(`👋 Bienvenue sur ${member.guild.name} !`)
    .setDescription(
      `Bienvenue ${member} ! Tu es le **${member.guild.memberCount}ème** membre du serveur ! 🎉`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({ text: 'Bonne arrivée parmi nous !' })
    .setTimestamp();

  channel.send({ embeds: [embed] });
});

// 📩 Messages
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // ⭐ XP écrit avec cooldown d'1 minute
  const now = Date.now();
  const lastMessage = cooldowns.get(message.author.id) || 0;
  if (now - lastMessage > 60 * 1000) {
    const xpGagné = Math.floor(Math.random() * 11) + 15;
    const result = addXP(message.author.id, message.author.username, xpGagné);
    cooldowns.set(message.author.id, now);

    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (member) await updateRoles(member, result.level);

    if (result.leveledUp) {
      const levelChannel = message.guild.channels.cache.find(c => c.name === '⚡levels');
if (levelChannel) levelChannel.send(`🎉 Félicitations ${message.author} ! Tu passes au niveau **${result.level}** ! 🚀`);
    }
  }

  if (!message.content.startsWith('!')) return;
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // !bonjour
  if (command === 'bonjour') {
    message.reply(`👋 Bonjour ${message.author.username} !`);
  }

  // !aide
  if (command === 'aide') {
    const embed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setTitle('📋 Commandes disponibles')
      .addFields(
        { name: '👋 Général', value: '`!bonjour` `!aide` `!rang` `!rang @user` `!classement`' },
        { name: '🛡️ Modération (admin)', value: '`!kick @user` `!ban @user` `!mute @user`' },
        { name: '⭐ XP (admin)', value: '`!givexp @user [montant]` `!removexp @user [montant]`' },
        { name: '🎫 Ticket (admin)', value: '`!setup-ticket`' }
      );
    message.reply({ embeds: [embed] });
  }

  // !rang
  if (command === 'rang') {
    const target = message.mentions.users.first() || message.author;
    const stats = getStats(target.id);
    if (!stats) return message.reply(`❌ ${target.username} n'a pas encore d'XP !`);

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
    message.reply({ embeds: [embed] });
  }

  // !classement
  if (command === 'classement') {
    const top = getLeaderboard();
    if (!top.length) return message.reply('❌ Aucun classement pour l\'instant.');
    const medals = ['🥇', '🥈', '🥉'];
    const lines = top.map(([id, data], i) =>
      `${medals[i] || `${i + 1}.`} **${data.username}** — Niveau ${data.level} (${data.xp} XP)`
    );
    const embed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setTitle('🏆 Classement du serveur')
      .setDescription(lines.join('\n'));
    message.reply({ embeds: [embed] });
  }

  // !kick
  if (command === 'kick') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return message.reply('❌ Tu n\'as pas la permission.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Mentionne un membre.');
    await member.kick().catch(err => message.reply(`❌ Erreur: ${err.message}`));
    message.reply(`✅ ${member.user.tag} a été expulsé.`);
  }

  // !ban
  if (command === 'ban') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return message.reply('❌ Tu n\'as pas la permission.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Mentionne un membre.');
    await member.ban().catch(err => message.reply(`❌ Erreur: ${err.message}`));
    message.reply(`✅ ${member.user.tag} a été banni.`);
  }

  // !mute
  if (command === 'mute') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return message.reply('❌ Tu n\'as pas la permission.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Mentionne un membre.');
    await member.timeout(10 * 60 * 1000).catch(err =>
      message.reply(`❌ Erreur: ${err.message}`)
    );
    message.reply(`✅ ${member.user.tag} est mute pour 10 minutes.`);
  }

  // !givexp
  if (command === 'givexp') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return message.reply('❌ Tu n\'as pas la permission.');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount) || amount <= 0)
      return message.reply('❌ Utilisation : `!givexp @user [montant]`');
    const result = addXP(target.id, target.username, amount);
    const member = await message.guild.members.fetch(target.id).catch(() => null);
    if (member) await updateRoles(member, result.level);
    message.reply(`✅ **+${amount} XP** donné à ${target.username} ! (Total : ${result.xp} XP — Niveau ${result.level})`);
  }

  // !removexp
  if (command === 'removexp') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return message.reply('❌ Tu n\'as pas la permission.');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount) || amount <= 0)
      return message.reply('❌ Utilisation : `!removexp @user [montant]`');
    const result = removeXP(target.id, amount);
    if (!result) return message.reply('❌ Cet utilisateur n\'a pas d\'XP.');
    const member = await message.guild.members.fetch(target.id).catch(() => null);
    if (member) await updateRoles(member, result.level);
    message.reply(`✅ **-${amount} XP** retiré à ${target.username} ! (Total : ${result.xp} XP — Niveau ${result.level})`);
  }

  // !setup-ticket
  if (command === 'setup-ticket') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return message.reply('❌ Tu n\'as pas la permission.');

    const embed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setTitle('🎫 Créer un ticket')
      .setDescription(
        'Tu as besoin d\'aide ? Clique sur le bouton ci-dessous pour ouvrir un ticket avec l\'équipe.'
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('📩 Créer un ticket')
        .setStyle(ButtonStyle.Secondary)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
  }
});

// 🎫 Boutons
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  // 📩 Créer un ticket
  if (interaction.customId === 'create_ticket') {
    const guild = interaction.guild;
    const user = interaction.user;

    // Vérifie si un ticket existe déjà
    const existing = guild.channels.cache.find(
      c => c.name === `ticket-${user.username.toLowerCase()}`
    );
    if (existing) {
      return interaction.reply({
        content: `❌ Tu as déjà un ticket ouvert : ${existing}`,
        ephemeral: true
      });
    }

    const adminRole = guild.roles.cache.find(r => r.name === 'Admin');
    const ticketCategory = guild.channels.cache.find(
      c => c.name.toLowerCase() === 'ticket' && c.type === ChannelType.GuildCategory
    );

    // Création du salon ticket
    const ticketChannel = await guild.channels.create({
      name: `ticket-${user.username.toLowerCase()}`,
      type: ChannelType.GuildText,
      parent: ticketCategory?.id || null,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        },
        ...(adminRole ? [{
          id: adminRole.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        }] : [])
      ]
    }).catch(err => {
      console.error('Erreur création ticket:', err.message);
      return null;
    });

    if (!ticketChannel) {
      return interaction.reply({
        content: '❌ Erreur lors de la création du ticket.',
        ephemeral: true
      });
    }

    // Message dans le salon ticket
    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('🔒 Fermer le ticket')
        .setStyle(ButtonStyle.Danger)
    );

    const ticketEmbed = new EmbedBuilder()
      .setColor(0x2C2F33)
      .setTitle(`🎫 Ticket de ${user.username}`)
      .setDescription(
        `Bonjour ${user} ! L'équipe va te répondre rapidement.\nExplique ton problème ci-dessous.`
      )
      .setTimestamp();

    await ticketChannel.send({ embeds: [ticketEmbed], components: [closeRow] });

    // Notification dans #ticket (catégorie Modération)
    const modTicketChannel = guild.channels.cache.find(c => {
      return (
        c.name.toLowerCase() === 'ticket' &&
        c.type === ChannelType.GuildText &&
        (
          c.parent?.name?.toLowerCase() === 'modération' ||
          c.parent?.name?.toLowerCase() === 'moderation'
        )
      );
    });

    if (modTicketChannel) {
      modTicketChannel.send(
        `📋 Nouveau ticket créé par **${user.tag}** → ${ticketChannel}`
      );
    }

    return interaction.reply({
      content: `✅ Ton ticket a été créé : ${ticketChannel}`,
      ephemeral: true
    });
  }

  // 🔒 Fermer un ticket
  if (interaction.customId === 'close_ticket') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: '❌ Seuls les admins peuvent fermer un ticket.',
        ephemeral: true
      });
    }
    await interaction.reply('🔒 Fermeture du ticket dans 5 secondes...');
    setTimeout(() => {
      interaction.channel.delete().catch(err =>
        console.error('Erreur suppression ticket:', err.message)
      );
    }, 5000);
  }
});

client.login(TOKEN);
