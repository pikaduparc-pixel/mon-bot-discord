const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  joinVoiceChannel,
  getVoiceConnection
} = require('@discordjs/voice');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

const guildStates = new Map();

function getState(guildId) {
  if (!guildStates.has(guildId)) {
    const player = createAudioPlayer();
    guildStates.set(guildId, {
      queue: [],
      player,
      connection: null,
      nowPlaying: null,
      loop: false,
      paused: false,
      textChannel: null,
    });
  }
  return guildStates.get(guildId);
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function createNowPlayingEmbed(song, requestedBy) {
  return new EmbedBuilder()
    .setColor(0xFF6B00)
    .setAuthor({ name: '🎵 En cours de lecture — Preview Deezer (30s)' })
    .setTitle(song.title)
    .setURL(song.pageUrl || song.url)
    .addFields(
      { name: '👤 Artiste', value: song.artist, inline: true },
      { name: '💿 Album', value: song.album || 'Inconnu', inline: true },
      { name: '📩 Demandé par', value: requestedBy ? `<@${requestedBy}>` : 'Inconnu', inline: true }
    )
    .setFooter({ text: 'Preview 30s via Deezer • /queue pour voir la file' })
    .setTimestamp()
    .setThumbnail(song.cover || null);
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
  const lines = queue.slice(0, 10).map((s, i) =>
    `**${i + 1}.** ${s.title} — ${s.artist} (${formatDuration(s.duration)})`
  );
  return new EmbedBuilder()
    .setColor(0xFF6B00)
    .setTitle('🎵 File d\'attente')
    .setDescription(
      (nowPlaying ? `**▶️ En cours :** ${nowPlaying.title} — ${nowPlaying.artist}\n\n` : '') +
      (lines.length ? lines.join('\n') : '*Queue vide*')
    )
    .setFooter({ text: `${queue.length} chanson(s) en attente` });
}

async function playSong(guildId) {
  const state = getState(guildId);

  if (state.queue.length === 0) {
    state.nowPlaying = null;
    const conn = getVoiceConnection(guildId);
    if (conn) conn.destroy();
    state.connection = null;
    if (state.textChannel) state.textChannel.send('✅ Queue terminée !').catch(() => {});
    return true;
  }

  const song = state.queue[0];
  state.nowPlaying = song;

  try {
    // Stream le MP3 directement depuis l'URL Deezer
    const response = await axios.get(song.url, {
      responseType: 'stream',
      timeout: 10000
    });

    const resource = createAudioResource(response.data, {
      inputType: StreamType.Arbitrary,
    });

    state.player.play(resource);

    if (state.textChannel) {
      state.textChannel.send({
        embeds: [createNowPlayingEmbed(song, song.requestedBy)],
        components: [createControlButtons(guildId)]
      }).catch(() => {});
    }
    return true;
  } catch (err) {
    console.error('Erreur lecture:', err.message);
    if (state.textChannel) {
      state.textChannel.send(`❌ Impossible de lire **${song.title}** : ${err.message.slice(0, 100)}`).catch(() => {});
    }
    state.queue.shift();
    if (state.queue.length > 0) return playSong(guildId);
    state.nowPlaying = null;
    const conn = getVoiceConnection(guildId);
    if (conn) conn.destroy();
    state.connection = null;
    return false;
  }
}

function setupPlayer(guildId) {
  const state = getState(guildId);
  state.player.removeAllListeners();

  state.player.on(AudioPlayerStatus.Idle, () => {
    if (state.loop && state.nowPlaying) {
      playSong(guildId);
    } else {
      state.queue.shift();
      playSong(guildId);
    }
  });

  state.player.on('error', (err) => {
    console.error('Player error:', err.message);
    if (state.textChannel) state.textChannel.send('❌ Erreur audio.').catch(() => {});
    state.queue.shift();
    playSong(guildId);
  });
}

async function addAndPlay(guildId, song, member, textChannel) {
  const state = getState(guildId);
  state.textChannel = textChannel;
  song.requestedBy = member.id;

  const wasEmpty = state.queue.length === 0;
  state.queue.push(song);

  if (!state.connection) {
    try {
      const connection = joinVoiceChannel({
        channelId: member.voice.channel.id,
        guildId,
        adapterCreator: member.guild.voiceAdapterCreator,
      });
      connection.subscribe(state.player);
      state.connection = connection;
      setupPlayer(guildId);
    } catch (err) {
      state.queue.pop();
      return { ok: false, error: `Impossible de rejoindre le vocal : ${err.message}` };
    }
  }

  if (wasEmpty) {
    const ok = await playSong(guildId);
    return { ok, error: ok ? null : 'Erreur lors de la lecture.' };
  }

  return { ok: true, queued: true };
}

function skipSong(guildId) { getState(guildId).player.stop(); }

function stopMusic(guildId) {
  const state = getState(guildId);
  state.queue = [];
  state.nowPlaying = null;
  state.loop = false;
  state.player.stop();
  const conn = getVoiceConnection(guildId);
  if (conn) conn.destroy();
  state.connection = null;
}

function togglePause(guildId) {
  const state = getState(guildId);
  if (state.paused) { state.player.unpause(); state.paused = false; return false; }
  else { state.player.pause(); state.paused = true; return true; }
}

function toggleLoop(guildId) {
  const state = getState(guildId);
  state.loop = !state.loop;
  return state.loop;
}

function getGuildState(guildId) { return getState(guildId); }

module.exports = {
  addAndPlay, skipSong, stopMusic, togglePause, toggleLoop,
  getGuildState, createNowPlayingEmbed, createControlButtons,
  createQueueEmbed, formatDuration
};
