/**
 * Gestionnaire de file d'attente musicale
 */
class MusicQueue {
  constructor() {
    this.queues = new Map(); // guildId -> queue
  }

  /**
   * Crée ou récupère une queue pour une guild
   */
  getQueue(guildId) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, {
        songs: [],
        playing: false,
        currentSong: null,
        voiceConnection: null,
        audioPlayer: null,
        loopMode: 'off' // 'off', 'one', 'all'
      });
    }
    return this.queues.get(guildId);
  }

  /**
   * Ajoute une chanson à la queue
   */
  addSong(guildId, song) {
    const queue = this.getQueue(guildId);
    queue.songs.push(song);
    return queue.songs.length;
  }

  /**
   * Récupère la chanson suivante
   */
  getNextSong(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.songs.length === 0) return null;
    return queue.songs.shift();
  }

  /**
   * Défini la chanson actuelle
   */
  setCurrentSong(guildId, song) {
    const queue = this.getQueue(guildId);
    queue.currentSong = song;
  }

  /**
   * Récupère la chanson actuelle
   */
  getCurrentSong(guildId) {
    const queue = this.getQueue(guildId);
    return queue.currentSong;
  }

  /**
   * Récupère la queue entière
   */
  getQueueList(guildId) {
    const queue = this.getQueue(guildId);
    return queue.songs;
  }

  /**
   * Vide la queue
   */
  clear(guildId) {
    if (this.queues.has(guildId)) {
      this.queues.get(guildId).songs = [];
    }
  }

  /**
   * Change le mode de boucle
   */
  toggleLoop(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.loopMode === 'off') queue.loopMode = 'one';
    else if (queue.loopMode === 'one') queue.loopMode = 'all';
    else queue.loopMode = 'off';
    return queue.loopMode;
  }

  /**
   * Définit le statut de lecture
   */
  setPlaying(guildId, state) {
    const queue = this.getQueue(guildId);
    queue.playing = state;
  }

  /**
   * Récupère le statut de lecture
   */
  isPlaying(guildId) {
    const queue = this.getQueue(guildId);
    return queue.playing;
  }

  /**
   * Supprime la queue d'une guild
   */
  deleteQueue(guildId) {
    this.queues.delete(guildId);
  }
}

module.exports = new MusicQueue();
