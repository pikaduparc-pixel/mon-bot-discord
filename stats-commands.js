const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { generateStatsImage } = require('./stats-image');
const { getStats, getLeaderboard } = require('./xp');
const axios = require('axios');

const statsCommands = [
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Affiche tes stats de style Statbot')
    .addUserOption(opt =>
      opt.setName('membre').setDescription('Le membre à consulter').setRequired(false)),

  new SlashCommandBuilder()
    .setName('leaderboard-image')
    .setDescription('Affiche le classement visuel en image'),
].map(cmd => cmd.toJSON());

/**
 * Gère les commandes de stats
 */
async function handleStatsCommand(interaction) {
  const cmd = interaction.commandName;

  if (cmd === 'stats') {
    await interaction.deferReply();
    const target = interaction.options.getUser('membre') || interaction.user;
    const stats = await getStats(target.id);

    if (!stats) {
      return interaction.editReply({
        content: `❌ ${target.username} n'a pas encore d'XP !`
      });
    }

    // Récupérer le rang
    const leaderboard = await getLeaderboard();
    const rank = leaderboard.findIndex(([id]) => id === target.id) + 1 || leaderboard.length + 1;

    // Récupérer l'avatar
    const avatarURL = target.displayAvatarURL({ format: 'png', size: 256 });
    let avatarBuffer;
    try {
      const response = await axios.get(avatarURL, { responseType: 'arraybuffer' });
      avatarBuffer = response.data;
    } catch (err) {
      console.error('Erreur récupération avatar:', err.message);
      avatarBuffer = null;
    }

    const userStats = {
      username: target.username,
      level: stats.level,
      xp: stats.xp,
      nextLevelXP: 1000 * Math.pow(1.05, stats.level),
      totalXP: stats.xp,
      rank: rank,
      messages: stats.messageCount || 0,
      voiceTime: Math.floor((stats.voiceTime || 0) / 3600) // en heures
    };

    try {
      const imageBuffer = await generateStatsImage(userStats, avatarBuffer);
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'stats.png' });
      return interaction.editReply({ files: [attachment] });
    } catch (err) {
      console.error('Erreur génération image:', err.message);
      // Fallback: embed simple
      const embed = new EmbedBuilder()
        .setColor(0xFF6B00)
        .setTitle(`📊 Stats de ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '⭐ Niveau', value: `${userStats.level}`, inline: true },
          { name: '🏆 Rang', value: `#${userStats.rank}`, inline: true },
          { name: '✨ XP', value: `${userStats.xp} / ${Math.floor(userStats.nextLevelXP)}`, inline: true },
          { name: '💬 Messages', value: `${userStats.messages}`, inline: true },
          { name: '🎤 Vocal', value: `${userStats.voiceTime}h`, inline: true }
        );
      return interaction.editReply({ embeds: [embed] });
    }
  }

  if (cmd === 'leaderboard-image') {
    await interaction.deferReply();
    const leaderboard = await getLeaderboard();

    if (leaderboard.length === 0) {
      return interaction.editReply({
        content: '❌ Aucun classement pour l\'instant.'
      });
    }

    // Récupérer les top 10
    const top10 = leaderboard.slice(0, 10);
    const embed = new EmbedBuilder()
      .setColor(0xFF6B00)
      .setTitle('🏆 Classement du serveur')
      .setDescription(
        top10.map(([id, data], i) => {
          const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
          return `${medal} **${data.username}** — Level ${data.level} (${data.xp} XP)`;
        }).join('\n')
      );

    return interaction.editReply({ embeds: [embed] });
  }
}

module.exports = {
  statsCommands,
  handleStatsCommand
};
