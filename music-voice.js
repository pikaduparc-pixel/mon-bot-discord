const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');

/**
 * Rejoindre le canal vocal
 */
async function joinVoiceChannel(member) {
  if (!member.voice.channel) {
    return null;
  }

  const connection = joinVoiceChannel({
    channelId: member.voice.channel.id,
    guildId: member.guild.id,
    adapterCreator: member.guild.voiceAdapterCreator,
  });

  return connection;
}

/**
 * Quitter le canal vocal
 */
function leaveVoiceChannel(guildId, client) {
  const guild = client.guilds.cache.get(guildId);
  if (guild) {
    guild.voiceConnection?.destroy();
  }
}

module.exports = {
  joinVoiceChannel,
  leaveVoiceChannel
};
