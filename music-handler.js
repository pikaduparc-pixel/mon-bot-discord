const {
  addAndPlay,
  skipSong,
  stopMusic,
  togglePause,
  toggleLoop,
  getGuildState,
  createNowPlayingEmbed,
  createControlButtons,
  createQueueEmbed
} = require('./music-player');

const { searchSong } = require('./music-search');

function isInBotVoiceChannel(interaction) {
  const botChannelId = interaction.guild?.members.me?.voice.channelId;
  return Boolean(botChannelId && interaction.member.voice.channelId === botChannelId);
}

async function handleMusicButton(interaction) {
  if (!isInBotVoiceChannel(interaction)) {
    return interaction.reply({ content: '❌ Rejoins le même canal vocal que le bot pour le contrôler.', ephemeral: true });
  }

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
    return interaction.reply({ content: looping ? '🔁 Boucle activée !' : '🔁 Boucle désactivée !', ephemeral: true });
  }
  if (id === `music_stop_${guildId}`) {
    stopMusic(guildId);
    return interaction.reply({ content: '⏹️ Musique arrêtée.', ephemeral: true });
  }
}

async function handlePlayCommand(interaction, args) {
  if (!interaction.member.voice.channel) {
    return interaction.reply({ content: '❌ Tu dois être dans un canal vocal !', ephemeral: true });
  }

  const state = getGuildState(interaction.guildId);
  if (state.connection && !isInBotVoiceChannel(interaction)) {
    return interaction.reply({ content: '❌ Le bot est déjà utilisé dans un autre canal vocal.', ephemeral: true });
  }

  const query = Array.isArray(args) ? args.join(' ') : interaction.options.getString('chanson');
  await interaction.deferReply();

  const song = await searchSong(query);
  if (!song || song.error) {
    return interaction.editReply(`❌ ${song?.error || 'Aucun résultat trouvé.'}`);
  }

  const result = await addAndPlay(interaction.guildId, song, interaction.member, interaction.channel);
  if (!result.ok) return interaction.editReply(`❌ ${result.error}`);
  return interaction.editReply(result.queued
    ? `✅ **${song.title}** a été ajouté à la file d’attente !`
    : `▶️ Lecture de **${song.title}** lancée !`);
}

async function handleSkipCommand(interaction) {
  const state = getGuildState(interaction.guildId);
  if (!state.nowPlaying) return interaction.reply({ content: '❌ Aucune musique en cours !', ephemeral: true });
  if (!isInBotVoiceChannel(interaction)) return interaction.reply({ content: '❌ Rejoins le même canal vocal que le bot.', ephemeral: true });
  skipSong(interaction.guildId);
  return interaction.reply('⏭️ Chanson passée !');
}

async function handleStopCommand(interaction) {
  const state = getGuildState(interaction.guildId);
  if (!state.nowPlaying) return interaction.reply({ content: '❌ Aucune musique en cours !', ephemeral: true });
  if (!isInBotVoiceChannel(interaction)) return interaction.reply({ content: '❌ Rejoins le même canal vocal que le bot.', ephemeral: true });
  stopMusic(interaction.guildId);
  return interaction.reply('⏹️ Musique arrêtée et file vidée !');
}

async function handleQueueCommand(interaction) {
  const state = getGuildState(interaction.guildId);
  return interaction.reply({ embeds: [createQueueEmbed(state.queue, state.nowPlaying)] });
}

async function handleNowPlayingCommand(interaction) {
  const state = getGuildState(interaction.guildId);
  if (!state.nowPlaying) return interaction.reply({ content: '❌ Aucune musique en cours !', ephemeral: true });
  return interaction.reply({
    embeds: [createNowPlayingEmbed(state.nowPlaying, state.nowPlaying.requestedBy)],
    components: [createControlButtons(interaction.guildId)]
  });
}

async function handlePauseCommand(interaction) {
  const state = getGuildState(interaction.guildId);
  if (!state.nowPlaying) return interaction.reply({ content: '❌ Aucune musique en cours !', ephemeral: true });
  if (!isInBotVoiceChannel(interaction)) return interaction.reply({ content: '❌ Rejoins le même canal vocal que le bot.', ephemeral: true });
  const nowPaused = togglePause(interaction.guildId);
  return interaction.reply(nowPaused ? '⏸️ Musique mise en pause.' : '▶️ Musique reprise !');
}

async function handleLoopCommand(interaction) {
  const state = getGuildState(interaction.guildId);
  if (!state.nowPlaying) return interaction.reply({ content: '❌ Aucune musique en cours !', ephemeral: true });
  if (!isInBotVoiceChannel(interaction)) return interaction.reply({ content: '❌ Rejoins le même canal vocal que le bot.', ephemeral: true });
  const looping = toggleLoop(interaction.guildId);
  return interaction.reply(looping ? '🔁 Boucle activée !' : '🔁 Boucle désactivée !');
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
