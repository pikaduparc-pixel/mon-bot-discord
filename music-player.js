const { AudioPlayer, AudioResource, createAudioPlayer, createAudioResource, StreamType, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

class MusicPlayer {
  constructor() {
    this.queues = new Map();
    this.players = new Map();
    this.nowPlaying = new Map();
  }

  /**
   * Ajouter une chanson à la queue
   */
  addToQueue(guildId, song) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, []);
    }
    this.queues.get(guildId).push(song);
  }

  /**
   * Récupérer la queue
   */
  getQueue(guildId) {
    return this.queues.get(guildId) || [];
  }

  /**
   * Vider la queue
   */
  clearQueue(guildId) {
    this.queues.delete(guildId);
  }

  /**
   * Passer à la prochaine chanson
   */
  skip(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.length > 0) {
      queue.shift();
      return true;
    }
    return false;
  }

  /**
   * Retourner la chanson en cours de lecture
   */
  getNowPlaying(guildId) {
    return this.nowPlaying.get(guildId);
  }

  /**
   * Définir la chanson en cours de lecture
   */
  setNowPlaying(guildId, song) {
    this.nowPlaying.set(guildId, song);
  }
}

const musicPlayer = new MusicPlayer();

/**
 * Créer l'embed de la chanson en cours de lecture
 */
function createNowPlayingEmbed(song) {
  const embed = new EmbedBuilder()
    .setColor(0xFF6B00)
    .setTitle('🎵 En cours de lecture')
    .setDescription(`**${song.title}**`)
    .addFields(
      { name: 'Artiste', value: song.artist, inline: true },
      { name: 'Durée', value: `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}`, inline: true },
      { name: 'Album', value: song.album || 'Inconnu', inline: true }
    )
    .setThumbnail(song.cover)
    .setTimestamp();

  return embed;
}

/**
 * Créer les boutons de contrôle
 */
function createControlButtons(guildId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`pause_${guildId}`)
      .setLabel('⏸️ Pause')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`skip_${guildId}`)
      .setLabel('⏭️ Skip')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`loop_${guildId}`)
      .setLabel('🔁 Boucle')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`stop_${guildId}`)
      .setLabel('⏹️ Stop')
      .setStyle(ButtonStyle.Danger)
  );

  return row;
}

/**
 * Créer l'embed de la queue
 */
function createQueueEmbed(queue, page = 1) {
  const itemsPerPage = 10;
  const totalPages = Math.ceil(queue.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const queuePage = queue.slice(startIndex, endIndex);

  const description = queuePage
    .map((song, i) => `**${startIndex + i + 1}.** ${song.title} - ${song.artist}`)
    .join('\n') || 'Queue vide';

  const embed = new EmbedBuilder()
    .setColor(0xFF6B00)
    .setTitle('🎵 File d\'attente')
    .setDescription(description)
    .setFooter({ text: `Page ${page}/${totalPages} • ${queue.length} chanson(s)` });

  return embed;
}

module.exports = {
  musicPlayer,
  createNowPlayingEmbed,
  createControlButtons,
  createQueueEmbed
};
