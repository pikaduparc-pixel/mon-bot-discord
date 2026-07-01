const { SlashCommandBuilder } = require('discord.js');
const { musicPlayer, createNowPlayingEmbed, createControlButtons, createQueueEmbed } = require('./music-player');
const { searchSong } = require('./music-search');
const { joinVoiceChannel, leaveVoiceChannel } = require('./music-voice');

const musicCommands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Joue une chanson')
    .addStringOption(opt =>
      opt.setName('chanson').setDescription('Nom ou URL de la chanson').setRequired(true)),

  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Met en pause la musique'),

  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Reprend la musique'),

  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Passe à la prochaine chanson'),

  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Arrête la musique et vide la queue'),

  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Affiche la file d\'attente'),

  new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Affiche la chanson en cours de lecture'),

  new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Change le mode boucle')
    .addStringOption(opt =>
      opt.setName('mode')
        .setDescription('Mode de boucle')
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Une chanson', value: 'one' },
          { name: 'Toute la queue', value: 'all' }
        )
        .setRequired(true))
].map(cmd => cmd.toJSON());

/**
 * Gérer les commandes musicales
 */
async function handleMusicCommand(interaction) {
  const cmd = interaction.commandName;
  const guildId = interaction.guildId;

  if (cmd === 'play') {
    await interaction.deferReply();
    const query = interaction.options.getString('chanson');
    
    // Vérifier que l'utilisateur est en vocal
    if (!interaction.member.voice.channel) {
      return interaction.editReply('❌ Tu dois être dans un canal vocal !');
    }

    // Rechercher la chanson
    const song = await searchSong(query);
    if (!song) {
      return interaction.editReply('❌ Chanson introuvable sur Deezer !');
    }

    // Ajouter à la queue
    musicPlayer.addToQueue(guildId, song);
    
    // Si c'est la première chanson, créer l'affichage
    if (!musicPlayer.getNowPlaying(guildId)) {
      musicPlayer.setNowPlaying(guildId, song);
      const embed = createNowPlayingEmbed(song);
      const buttons = createControlButtons(guildId);
      
      return interaction.editReply({
        content: '▶️ **Lecture en cours**',
        embeds: [embed],
        components: [buttons]
      });
    }

    // Sinon, juste l'ajouter à la queue
    return interaction.editReply(`✅ **${song.title}** ajoutée à la queue !`);
  }

  if (cmd === 'queue') {
    const queue = musicPlayer.getQueue(guildId);
    if (queue.length === 0) {
      return interaction.reply('❌ La queue est vide !');
    }

    const embed = createQueueEmbed(queue);
    return interaction.reply({ embeds: [embed] });
  }

  if (cmd === 'nowplaying') {
    const song = musicPlayer.getNowPlaying(guildId);
    if (!song) {
      return interaction.reply('❌ Aucune chanson en cours de lecture !');
    }

    const embed = createNowPlayingEmbed(song);
    const buttons = createControlButtons(guildId);
    return interaction.reply({
      embeds: [embed],
      components: [buttons]
    });
  }

  if (cmd === 'skip') {
    if (musicPlayer.skip(guildId)) {
      const queue = musicPlayer.getQueue(guildId);
      if (queue.length > 0) {
        const nextSong = queue[0];
        musicPlayer.setNowPlaying(guildId, nextSong);
        const embed = createNowPlayingEmbed(nextSong);
        const buttons = createControlButtons(guildId);
        return interaction.reply({
          content: '⏭️ **Passage à la chanson suivante**',
          embeds: [embed],
          components: [buttons]
        });
      } else {
        musicPlayer.setNowPlaying(guildId, null);
        leaveVoiceChannel(guildId, interaction.client);
        return interaction.reply('✅ Queue terminée, canal fermé !');
      }
    }
    return interaction.reply('❌ Aucune chanson à passer !');
  }

  if (cmd === 'stop') {
    musicPlayer.clearQueue(guildId);
    musicPlayer.setNowPlaying(guildId, null);
    leaveVoiceChannel(guildId, interaction.client);
    return interaction.reply('⏹️ Musique arrêtée, queue vidée !');
  }

  if (cmd === 'pause') {
    return interaction.reply('⏸️ Pause (Feature en développement)');
  }

  if (cmd === 'resume') {
    return interaction.reply('▶️ Reprise (Feature en développement)');
  }

  if (cmd === 'loop') {
    const mode = interaction.options.getString('mode');
    // Stocker le mode de boucle pour plus tard
    return interaction.reply(`🔁 Mode boucle défini sur : **${mode}**`);
  }
}

module.exports = {
  musicCommands,
  handleMusicCommand
};
