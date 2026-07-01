const { addAndPlay, skipSong, stopMusic, togglePause, toggleLoop, getGuildState, createNowPlayingEmbed, createControlButtons, createQueueEmbed } = require('./music-player');
const { searchSong } = require('./music-search');

async function handleMusicButton(interaction) {
  const guildId = interaction.guildId;
  const id = interaction.customId;

  if (id === `music_pause_${guildId}`) {
    const nowPaused = togglePause(guildId);
    return interaction.reply({ content: nowPaused ? '⏸️ Musique mise en pause.' : '▶️ Musique reprise !', ephemeral: true });
  }
  if (id === `music_skip_${guildId}`) {
    skipSong(guildId);
    return interaction.reply({ content: '⏭️ Chanson passée !', ephemeral: true });
  }
  if (id === `music_loop_${guildId}`) {
    const looping = toggleLoop(guildId);
    return interaction.reply({ content: looping ? '🔁 Boucle **activée** !' : '🔁 Boucle **désactivée** !', ephemeral: true });
  }
  if (id === `music_stop_${guildId}`) {
    stopMusic(guildId);
    return interaction.reply({ content: '⏹️ Musique arrêtée.', ephemeral: true });
  }
}

// /play — interaction est une slash command
async function handlePlayCommand(interaction, args) {
  if (!interaction.member.voice.channel)
    return interaction.reply({ content: '❌ Tu dois être dans un canal vocal !', ephemeral: true });

  const query = Array.isArray(args) ? args.join(' ') : interaction.options.getString('chanson');
  await interaction.deferReply();

  let song;
  try {
    song = await searchSong(query);
  } catch (err) {
    return interaction.editReply(`❌ Erreur de recherche : ${err.message}`);
  }

  if (!song) return interaction.editReply('❌ Aucun résultat trouvé.');
  if (song.error) return interaction.editReply(`❌ ${song.error}`);

  let result;
  try {
    result = await addAndPlay(interaction.guildId, song, interaction.member, interaction.channel);
  } catch (err) {
    return interaction.editReply(`❌ Erreur de lecture : ${err.message}`);
  }

  if (!result.ok) return interaction.editReply(`❌ ${result.error}`);
  if (result.queued) return interaction.editReply(`✅ **${song.title}** ajouté à la queue !`);
  return interaction.editReply(`▶️ Lecture de **${song.title}** lancée !`);
}

async function handleSkipCommand(interaction) {
  const state = getGuildState(interaction.guildId);
  if (!state.nowPlaying) return interaction.reply({ content: '❌ Aucune musique en cours !', ephemeral: true });
  skipSong(interaction.guildId);
  return interaction.reply('⏭️ Chanson passée !');
}

async function handleStopCommand(interaction) {
  const state = getGuildState(interaction.guildId);
  if (!state.nowPlaying) return interaction.reply({ content: '❌ Aucune musique en cours !', ephemeral: true });
  stopMusic(interaction.guildId);
  return interaction.reply('⏹️ Musique arrêtée et queue vidée !');
}

async function handleQueueCommand(interaction) {
  const state = getGuildState(interaction.guildId);
  const embed = createQueueEmbed(state.queue, state.nowPlaying);
  return interaction.reply({ embeds: [embed] });
}

async function handleNowPlayingCommand(interaction) {
  const state = getGuildState(interaction.guildId);
  if (!state.nowPlaying) return interaction.reply({ content: '❌ Aucune musique en cours !', ephemeral: true });
  const embed = createNowPlayingEmbed(state.nowPlaying, state.nowPlaying.requestedBy);
  const buttons = createControlButtons(interaction.guildId);
  return interaction.reply({ embeds: [embed], components: [buttons] });
}

async function handlePauseCommand(interaction) {
  const state = getGuildState(interaction.guildId);
  if (!state.nowPlaying) return interaction.reply({ content: '❌ Aucune musique en cours !', ephemeral: true });
  const nowPaused = togglePause(interaction.guildId);
  return interaction.reply(nowPaused ? '⏸️ Musique mise en pause.' : '▶️ Musique reprise !');
}

async function handleLoopCommand(interaction) {
  const looping = toggleLoop(interaction.guildId);
  return interaction.reply(looping ? '🔁 Boucle **activée** !' : '🔁 Boucle **désactivée** !');
}

module.exports = {
  handleMusicButton,
  handlePlayCommand,
  handleSkipCommand,
  handleStopCommand,
  handleQueueCommand,
  handleNowPlayingCommand,
  handlePauseCommand,
  handleLoopCommand
};
