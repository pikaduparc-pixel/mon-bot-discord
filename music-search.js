const axios = require('axios');

/**
 * Rechercher une chanson sur Deezer
 */
async function searchSong(query) {
  try {
    const response = await axios.get('https://api.deezer.com/search', {
      params: {
        q: query,
        limit: 1
      }
    });

    if (response.data.data.length === 0) {
      return null;
    }

    const track = response.data.data[0];
    return {
      id: track.id,
      title: track.title,
      artist: track.artist.name,
      album: track.album.title,
      duration: track.duration,
      cover: track.album.cover_big,
      previewUrl: track.preview // URL de preview 30 secondes
    };
  } catch (err) {
    console.error('Erreur recherche Deezer:', err.message);
    return null;
  }
}

/**
 * Récupérer les détails d'une chanson par ID
 */
async function getSongById(id) {
  try {
    const response = await axios.get(`https://api.deezer.com/track/${id}`);
    const track = response.data;

    return {
      id: track.id,
      title: track.title,
      artist: track.artist.name,
      album: track.album.title,
      duration: track.duration,
      cover: track.album.cover_big,
      previewUrl: track.preview
    };
  } catch (err) {
    console.error('Erreur récupération Deezer:', err.message);
    return null;
  }
}

module.exports = {
  searchSong,
  getSongById
};
