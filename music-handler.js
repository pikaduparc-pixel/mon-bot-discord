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
    return interaction.reply({ content: '⏹️ Musique arrêtée et queue vidée.', ephemeral: true });
  }
}

async function handlePlayCommand(message, args) {
  if (!message.member.voice.channel)
    return message.reply('❌ Tu dois être dans un canal vocal pour lancer de la musique !');
  if (!args.length)
    return message.reply('❌ Utilisation : `!play <nom de la chanson ou lien YouTube>`');

  const query = args.join(' ');
  const searching = await message.reply('🔍 Recherche en cours...');

  const song = await searchSong(query);
  if (!song) {
    return searching.edit('❌ Aucun résultat trouvé. Essaie un autre nom ou un lien YouTube.');
  }

  await searching.delete().catch(() => {});
  await addAndPlay(message.guildId, song, message.member, message.channel);
}

async function handleSkipCommand(message) {
  const state = getGuildState(message.guildId);
  if (!state.nowPlaying) return message.reply('❌ Aucune musique en cours !');
  skipSong(message.guildId);
  message.reply('⏭️ Chanson passée !');
}

async function handleStopCommand(message) {
  const state = getGuildState(message.guildId);
  if (!state.nowPlaying) return message.reply('❌ Aucune musique en cours !');
  stopMusic(message.guildId);
  message.reply('⏹️ Musique arrêtée et queue vidée !');
}

async function handleQueueCommand(message) {
  const state = getGuildState(message.guildId);
  const embed = createQueueEmbed(state.queue, state.nowPlaying);
  message.reply({ embeds: [embed] });
}

async function handleNowPlayingCommand(message) {
  const state = getGuildState(message.guildId);
  if (!state.nowPlaying) return message.reply('❌ Aucune musique en cours !');
  const embed = createNowPlayingEmbed(state.nowPlaying, state.nowPlaying.requestedBy);
  const buttons = createControlButtons(message.guildId);
  message.reply({ embeds: [embed], components: [buttons] });
}

async function handlePauseCommand(message) {
  const state = getGuildState(message.guildId);
  if (!state.nowPlaying) return message.reply('❌ Aucune musique en cours !');
  const nowPaused = togglePause(message.guildId);
  message.reply(nowPaused ? '⏸️ Musique mise en pause.' : '▶️ Musique reprise !');
}

async function handleLoopCommand(message) {
  const looping = toggleLoop(message.guildId);
  message.reply(looping ? '🔁 Boucle **activée** !' : '🔁 Boucle **désactivée** !');
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
