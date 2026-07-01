const playdl = require('play-dl');

// Timeout helper
function withTimeout(promise, ms, msg) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms))
  ]);
}

async function searchSong(query) {
  try {
    let url = query;

    if (!query.startsWith('http')) {
      const results = await withTimeout(
        playdl.search(query, { limit: 1 }),
        10000,
        'Recherche trop longue — YouTube bloque peut-être les requêtes depuis Render'
      );
      if (!results || results.length === 0) return { error: 'Aucun résultat trouvé.' };
      url = results[0].url;
    }

    const info = await withTimeout(
      playdl.video_info(url),
      10000,
      'Récupération des infos trop longue — YouTube bloque peut-être les requêtes'
    );
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
    console.error('Erreur recherche:', err.message);
    return { error: err.message };
  }
}

module.exports = { searchSong };
