const axios = require('axios');

async function searchSong(query) {
  try {
    // Recherche via l'API publique Deezer (pas d'IP block contrairement à YouTube)
    const response = await axios.get('https://api.deezer.com/search', {
      params: { q: query, limit: 5 },
      timeout: 8000
    });

    const tracks = response.data?.data;
    if (!tracks || tracks.length === 0) return { error: 'Aucune chanson trouvée sur Deezer.' };

    // Préfère un track avec preview disponible
    const track = tracks.find(t => t.preview) || tracks[0];
    if (!track.preview) return { error: 'Aucune preview disponible pour cette chanson.' };

    return {
      url: track.preview,           // MP3 direct (30s)
      pageUrl: track.link,
      title: track.title,
      artist: track.artist.name,
      album: track.album.title,
      duration: Math.min(track.duration, 30), // preview = 30s
      cover: track.album.cover_big,
      requestedBy: null
    };
  } catch (err) {
    console.error('Erreur Deezer:', err.message);
    return { error: `Erreur de recherche : ${err.message}` };
  }
}

module.exports = { searchSong };
