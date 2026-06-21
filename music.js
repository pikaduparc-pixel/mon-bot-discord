const axios = require('axios');

const DEEZER_API = 'https://api.deezer.com';

/**
 * Recherche une chanson sur Deezer
 * @param {string} query - Titre ou artiste à chercher
 * @returns {Promise<Object|null>} - Info de la chanson ou null
 */
async function searchTrack(query) {
  try {
    const response = await axios.get(`${DEEZER_API}/search/track`, {
      params: { q: query, limit: 1 }
    });

    if (!response.data.data || response.data.data.length === 0) {
      return null;
    }

    const track = response.data.data[0];
    return formatTrackData(track);
  } catch (error) {
    console.error('Erreur recherche Deezer:', error.message);
    return null;
  }
}

/**
 * Récupère les infos d'une chanson par ID
 * @param {string} trackId - ID de la chanson
 * @returns {Promise<Object|null>} - Info de la chanson ou null
 */
async function getTrackById(trackId) {
  try {
    const response = await axios.get(`${DEEZER_API}/track/${trackId}`);
    return formatTrackData(response.data);
  } catch (error) {
    console.error('Erreur récupération track:', error.message);
    return null;
  }
}

/**
 * Formate les données d'une chanson
 * @param {Object} track - Données brutes de Deezer
 * @returns {Object} - Données formatées
 */
function formatTrackData(track) {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist?.name || 'Artiste inconnu',
    album: track.album?.title || 'Album inconnu',
    duration: track.duration,
    cover: track.album?.cover_big || track.album?.cover_medium || 'https://via.placeholder.com/500',
    preview: track.preview,
    url: track.link,
    deezerUrl: track.link
  };
}

/**
 * Extrait l'ID Deezer d'un URL
 * @param {string} url - URL Deezer
 * @returns {string|null} - ID ou null
 */
function extractDeezerTrackId(url) {
  const match = url.match(/deezer\.com\/track\/(\d+)/);
  return match ? match[1] : null;
}

module.exports = {
  searchTrack,
  getTrackById,
  formatTrackData,
  extractDeezerTrackId
};
