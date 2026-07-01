const playdl = require('play-dl');

async function searchSong(query) {
  try {
    let url = query;

    // Si c'est pas une URL YouTube, on cherche
    if (!query.startsWith('http')) {
      const results = await playdl.search(query, { limit: 1 });
      if (!results || results.length === 0) return null;
      url = results[0].url;
    }

    const info = await playdl.video_info(url);
    const v = info.video_details;

    return {
      url: v.url,
      title: v.title || 'Titre inconnu',
      artist: v.channel?.name || 'Inconnu',
      duration: v.durationInSec || 0,
      cover: v.thumbnails?.[v.thumbnails.length - 1]?.url || null,
      requestedBy: null
    };
  } catch (err) {
    console.error('Erreur recherche musique:', err.message);
    return null;
  }
}

module.exports = { searchSong };
