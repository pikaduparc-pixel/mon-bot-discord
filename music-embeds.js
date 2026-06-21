const { EmbedBuilder } = require('discord.js');

/**
 * Crée un embed pour la chanson actuelle
 */
function createNowPlayingEmbed(track, currentTime = 0) {
  const minutes = Math.floor(track.duration / 60);
  const seconds = track.duration % 60;
  const currentMin = Math.floor(currentTime / 60);
  const currentSec = currentTime % 60;

  const progressPercent = Math.floor((currentTime / track.duration) * 100);
  const progressBar = '▰'.repeat(Math.floor(progressPercent / 5)) + '▱'.repeat(20 - Math.floor(progressPercent / 5));

  const embed = new EmbedBuilder()
    .setColor(0xFF6B00) // Couleur Deezer
    .setTitle('🎵 EN COURS DE LECTURE')
    .setDescription(`**${track.title}**\npar ${track.artist}`)
    .setThumbnail(track.cover)
    .addFields(
      { name: '📀 Album', value: track.album, inline: true },
      { name: '⏱️ Durée', value: `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`, inline: true },
      { name: '🔗 Source', value: '[Deezer](https://www.deezer.com)', inline: true },
      { name: '⏯️ Progression', value: `${progressBar}\n${currentMin}:${currentSec < 10 ? '0' : ''}${currentSec} / ${minutes}:${seconds < 10 ? '0' : ''}${seconds}` }
    )
    .setFooter({ text: 'Système musical Maki 🎧' })
    .setTimestamp();

  return embed;
}

/**
 * Crée un embed pour la queue
 */
function createQueueEmbed(queue, page = 1) {
  const itemsPerPage = 10;
  const totalPages = Math.ceil(queue.length / itemsPerPage);
  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = queue.slice(start, end);

  const description = pageItems.length > 0
    ? pageItems.map((track, i) => `**${start + i + 1}.** ${track.title} - ${track.artist}`).join('\n')
    : 'La queue est vide !';

  const embed = new EmbedBuilder()
    .setColor(0xFF6B00)
    .setTitle('🎵 FILE D\'ATTENTE')
    .setDescription(description)
    .setFooter({ text: `Page ${page}/${totalPages} (${queue.length} chansons)` })
    .setTimestamp();

  return embed;
}

/**
 * Crée un embed pour la fin de la musique
 */
function createEndEmbed(track) {
  const embed = new EmbedBuilder()
    .setColor(0x999999)
    .setTitle('⏹️ MUSIQUE TERMINÉE')
    .setDescription(`**${track.title}**\npar ${track.artist}`)
    .setThumbnail(track.cover)
    .setFooter({ text: 'Merci d\'avoir écouté !' })
    .setTimestamp();

  return embed;
}

/**
 * Crée un embed pour une erreur
 */
function createErrorEmbed(message) {
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('❌ ERREUR')
    .setDescription(message)
    .setTimestamp();

  return embed;
}

/**
 * Crée un embed pour un succès
 */
function createSuccessEmbed(title, description) {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();

  return embed;
}

module.exports = {
  createNowPlayingEmbed,
  createQueueEmbed,
  createEndEmbed,
  createErrorEmbed,
  createSuccessEmbed
};
