const { SlashCommandBuilder } = require('discord.js');
const { searchTrack, extractDeezerTrackId, getTrackById } = require('./music');
const queue = require('./queue');
const { createNowPlayingEmbed, createQueueEmbed, createErrorEmbed, createSuccessEmbed } = require('./music-embeds');

const musicCommands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Lance une chanson (titre ou lien Deezer)')
    .addStringOption(opt =>
      opt.setName('recherche').setDescription('Titre de la chanson ou lien Deezer').setRequired(true)),

  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Met en pause la musique en cours'),

  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Reprend la musique'),

  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Saute à la chanson suivante'),

  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Arrête la musique et vide la queue'),

  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Affiche la file d\'attente')
    .addIntegerOption(opt =>
      opt.setName('page').setDescription('Numéro de page').setRequired(false).setMinValue(1)),

  new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Affiche la chanson en cours'),

  new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Change le mode de boucle (off → one → all)'),
];

/**
 * Gère les commandes musicales
 */
async function handleMusicCommand(interaction) {
  const cmd = interaction.commandName;
  const guildQueue = queue.getQueue(interaction.guildId);

  if (cmd === 'play') {
    await interaction.deferReply();
    const search = interaction.options.getString('recherche');
    let track = null;

    // Vérifier si c'est un lien Deezer
    if (search.includes('deezer.com')) {
      const trackId = extractDeezerTrackId(search);
      if (trackId) {
        track = await getTrackById(trackId);
      }
    } else {
      // Sinon, chercher par titre
      track = await searchTrack(search);
    }

    if (!track) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Chanson non trouvée ! 😢')]
      });
    }

    queue.addSong(interaction.guildId, track);

    if (!guildQueue.currentSong) {
      queue.setCurrentSong(interaction.guildId, track);
      queue.setPlaying(interaction.guildId, true);
    }

    const embed = createSuccessEmbed(
      'Chanson ajoutée ! 🎵',
      `**${track.title}** par ${track.artist}\n\n${guildQueue.currentSong ? `File d'attente: ${queue.getQueueList(interaction.guildId).length} chanson(s)` : 'En cours de lecture...'}`
    );

    return interaction.editReply({ embeds: [embed] });
  }

  if (cmd === 'pause') {
    if (!guildQueue.currentSong) {
      return interaction.reply({
        embeds: [createErrorEmbed('Aucune chanson en cours de lecture.')],
        ephemeral: true
      });
    }

    queue.setPlaying(interaction.guildId, false);
    return interaction.reply({
      embeds: [createSuccessEmbed('Pause', '⏸️ Musique mise en pause.')],
      ephemeral: true
    });
  }

  if (cmd === 'resume') {
    if (!guildQueue.currentSong) {
      return interaction.reply({
        embeds: [createErrorEmbed('Aucune chanson en cours de lecture.')],
        ephemeral: true
      });
    }

    queue.setPlaying(interaction.guildId, true);
    return interaction.reply({
      embeds: [createSuccessEmbed('Reprise', '▶️ Musique reprise.')],
      ephemeral: true
    });
  }

  if (cmd === 'skip') {
    if (!guildQueue.currentSong) {
      return interaction.reply({
        embeds: [createErrorEmbed('Aucune chanson en cours de lecture.')],
        ephemeral: true
      });
    }

    const nextSong = queue.getNextSong(interaction.guildId);
    if (nextSong) {
      queue.setCurrentSong(interaction.guildId, nextSong);
      return interaction.reply({
        embeds: [createSuccessEmbed('Skip', `⏭️ Passage à: **${nextSong.title}** par ${nextSong.artist}`)],
        ephemeral: true
      });
    } else {
      queue.setCurrentSong(interaction.guildId, null);
      queue.setPlaying(interaction.guildId, false);
      return interaction.reply({
        embeds: [createSuccessEmbed('Fin', '✅ Queue terminée.')],
        ephemeral: true
      });
    }
  }

  if (cmd === 'stop') {
    queue.clear(interaction.guildId);
    queue.setCurrentSong(interaction.guildId, null);
    queue.setPlaying(interaction.guildId, false);

    return interaction.reply({
      embeds: [createSuccessEmbed('Arrêt', '⏹️ Musique arrêtée et queue vidée.')],
      ephemeral: true
    });
  }

  if (cmd === 'queue') {
    const page = interaction.options.getInteger('page') || 1;
    const queueList = queue.getQueueList(interaction.guildId);

    if (queueList.length === 0 && !guildQueue.currentSong) {
      return interaction.reply({
        embeds: [createErrorEmbed('La queue est vide.')],
        ephemeral: true
      });
    }

    const embed = createQueueEmbed(queueList, page);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (cmd === 'nowplaying') {
    if (!guildQueue.currentSong) {
      return interaction.reply({
        embeds: [createErrorEmbed('Aucune chanson en cours de lecture.')],
        ephemeral: true
      });
    }

    const embed = createNowPlayingEmbed(guildQueue.currentSong);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (cmd === 'loop') {
    const mode = queue.toggleLoop(interaction.guildId);
    const modeText = mode === 'off' ? 'Désactivé ❌' : mode === 'one' ? 'Une seule chanson 🔂' : 'Toute la queue 🔁';

    return interaction.reply({
      embeds: [createSuccessEmbed('Mode boucle', `Mode actuel: ${modeText}`)],
      ephemeral: true
    });
  }
}

module.exports = {
  musicCommands: musicCommands.map(cmd => cmd.toJSON()),
  handleMusicCommand
};
