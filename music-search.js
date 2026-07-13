const play = require('play-dl');

function formatSong(video) {
  const thumbnails = video.thumbnails || [];
  return {
    url: video.url,
    pageUrl: video.url,
    title: video.title || 'Titre inconnu',
    artist: video.channel?.name || video.channel?.url || 'Artiste inconnu',
    album: 'YouTube',
    duration: Number(video.durationInSec) || 0,
    cover: thumbnails.at(-1)?.url || null,
    requestedBy: null
  };
}

async function searchSong(query) {
  const input = query?.trim();
  if (!input) return { error: 'Indique un titre ou un lien YouTube.' };

  try {
    const validation = play.yt_validate(input);
    if (validation === 'video') {
      const info = await play.video_basic_info(input);
      return formatSong(info.video_details);
    }

    if (validation === 'playlist') {
      return { error: 'Les playlists ne sont pas encore prises en charge. Choisis une vidéo ou indique un titre.' };
    }

    const results = await play.search(input, {
      limit: 1,
      source: { youtube: 'video' }
    });

    if (!results.length) return { error: 'Aucune chanson trouvée sur YouTube.' };
    return formatSong(results[0]);
  } catch (error) {
    console.error('[Music] Erreur de recherche YouTube:', error.message);
    return { error: 'La recherche YouTube a échoué. Réessaie avec un autre titre ou un lien vidéo.' };
  }
}

module.exports = { searchSong };
