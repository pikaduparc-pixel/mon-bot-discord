const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
  getVoiceConnection
} = require('@discordjs/voice');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const play = require('play-dl');

const guildStates = new Map();

function getState(guildId) {
  if (!guildStates.has(guildId)) {
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
    });

    guildStates.set(guildId, {
      queue: [],
      player,
      connection: null,
      nowPlaying: null,
      loop: false,
      paused: false,
      skipRequested: false,
      textChannel: null
    });
  }
  return guildStates.get(guildId);
}

function formatDuration(seconds) {
  const value = Number(seconds) || 0;
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

function createNowPlayingEmbed(song, requestedBy) {
  return new EmbedBuilder()
    .setColor(0xFF0000)
    .setAuthor({ name: '🎵 En cours de lecture — YouTube' })
    .setTitle(song.title)
    .setURL(song.pageUrl || song.url)
    .addFields(
      { name: '👤 Chaîne', value: song.artist, inline: true },
      { name: '⏱️ Durée', value: formatDuration(song.duration), inline: true },
      { name: '📩 Demandé par', value: requestedBy ? `<@${requestedBy}>` : 'Inconnu', inline: true }
    )
    .setFooter({ text: 'Utilise les boutons ou /queue pour contrôler la musique.' })
    .setTimestamp()
    .setThumbnail(song.cover);
}

function createControlButtons(guildId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`music_pause_${guildId}`).setLabel('⏸️ Pause').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`music_skip_${guildId}`).setLabel('⏭️ Skip').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`music_loop_${guildId}`).setLabel('🔁 Boucle').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`music_stop_${guildId}`).setLabel('⏹️ Stop').setStyle(ButtonStyle.Danger)
  );
}

function createQueueEmbed(queue, nowPlaying) {
  const lines = queue.slice(1, 11).map((song, index) =>
    `**${index + 1}.** ${song.title} — ${song.artist} (${formatDuration(song.duration)})`
  );

  return new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('🎵 File d’attente')
    .setDescription(
      (nowPlaying ? `**▶️ En cours :** ${nowPlaying.title} — ${nowPlaying.artist}\n\n` : '') +
      (lines.length ? lines.join('\n') : '*Aucune autre chanson en attente*')
    )
    .setFooter({ text: `${Math.max(0, queue.length - 1)} chanson(s) en attente` });
}

function disconnect(guildId) {
  const state = getState(guildId);
  const connection = state.connection || getVoiceConnection(guildId);
  if (connection) connection.destroy();
  state.connection = null;
  state.nowPlaying = null;
  state.paused = false;
  state.skipRequested = false;
}

async function playSong(guildId) {
  const state = getState(guildId);
  const song = state.queue[0];

  if (!song) {
    disconnect(guildId);
    if (state.textChannel) state.textChannel.send('✅ File d’attente terminée !').catch(() => {});
    return;
  }

  state.nowPlaying = song;
  state.paused = false;

  try {
    const stream = await play.stream(song.url, { discordPlayerCompatibility: true });
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      metadata: { title: song.title }
    });

    state.player.play(resource);
    if (state.textChannel) {
      state.textChannel.send({
        embeds: [createNowPlayingEmbed(song, song.requestedBy)],
        components: [createControlButtons(guildId)]
      }).catch(() => {});
    }
  } catch (error) {
    console.error('[Music] Impossible de lire la vidéo:', error.message);
    if (state.textChannel) {
      state.textChannel.send(`❌ Impossible de lire **${song.title}**. Passage au titre suivant.`).catch(() => {});
    }
    state.queue.shift();
    state.nowPlaying = null;
    return playSong(guildId);
  }
}

function advanceSong(guildId) {
  const state = getState(guildId);
  if (!state.nowPlaying) return;

  const repeatCurrent = state.loop && !state.skipRequested;
  state.skipRequested = false;
  state.paused = false;

  if (!repeatCurrent) state.queue.shift();
  state.nowPlaying = null;
  playSong(guildId).catch(error => console.error('[Music] Avance impossible:', error.message));
}

function setupPlayer(guildId) {
  const state = getState(guildId);
  state.player.removeAllListeners();

  state.player.on(AudioPlayerStatus.Idle, () => advanceSong(guildId));
  state.player.on('error', error => {
    console.error('[Music] Erreur du lecteur:', error.message);
    advanceSong(guildId);
  });
}

async function addAndPlay(guildId, song, member, textChannel) {
  const state = getState(guildId);
  state.textChannel = textChannel;
  song.requestedBy = member.id;

  const wasEmpty = state.queue.length === 0;
  state.queue.push(song);

  try {
    if (!state.connection) {
      const connection = joinVoiceChannel({
        channelId: member.voice.channel.id,
        guildId,
        adapterCreator: member.guild.voiceAdapterCreator,
        selfDeaf: true
      });
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
      connection.subscribe(state.player);
      state.connection = connection;
      setupPlayer(guildId);
    }

    if (wasEmpty) await playSong(guildId);
    return { ok: true, queued: !wasEmpty };
  } catch (error) {
    console.error('[Music] Connexion vocale impossible:', error.message);
    state.queue = state.queue.filter(queuedSong => queuedSong !== song);
    disconnect(guildId);
    return { ok: false, error: 'Impossible de rejoindre le canal vocal.' };
  }
}

function skipSong(guildId) {
  const state = getState(guildId);
  state.skipRequested = true;
  state.player.stop();
}

function stopMusic(guildId) {
  const state = getState(guildId);
  state.queue = [];
  state.nowPlaying = null;
  state.loop = false;
  state.player.stop(true);
  disconnect(guildId);
}

function togglePause(guildId) {
  const state = getState(guildId);
  if (state.paused) {
    state.player.unpause();
    state.paused = false;
  } else {
    state.player.pause();
    state.paused = true;
  }
  return state.paused;
}

function toggleLoop(guildId) {
  const state = getState(guildId);
  state.loop = !state.loop;
  return state.loop;
}

function getGuildState(guildId) {
  return getState(guildId);
}

module.exports = {
  addAndPlay,
  skipSong,
  stopMusic,
  togglePause,
  toggleLoop,
  getGuildState,
  createNowPlayingEmbed,
  createControlButtons,
  createQueueEmbed,
  formatDuration
};
