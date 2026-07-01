const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

/**
 * Génère une image de stats style Statbot
 * @param {Object} userStats - Stats de l'utilisateur
 * @param {Object} avatarBuffer - Buffer de l'avatar
 * @returns {Promise<Buffer>} - Buffer de l'image
 */
async function generateStatsImage(userStats, avatarBuffer) {
  const width = 1000;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fond dégradé (noir à gris)
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1a1a1a');
  gradient.addColorStop(1, '#2d2d2d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Couleur Deezer (accent)
  const accentColor = '#FF6B00';

  // ── AVATAR ────────────────────────────────────────────────────────
  const Image = require('canvas').Image;
  const img = new Image();
  img.src = avatarBuffer;

  // Avatar circulaire
  ctx.save();
  ctx.beginPath();
  ctx.arc(120, 120, 90, 0, Math.PI * 2);
  ctx.fillStyle = accentColor;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(120, 120, 85, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, 30, 30, 180, 180);
  ctx.restore();

  // ── TEXTE PRINCIPAL ────────────────────────────────────────────────
  ctx.font = 'bold 48px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(userStats.username, 250, 100);

  ctx.font = '24px Arial';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText(`Level ${userStats.level}`, 250, 140);

  // ── BARRE DE PROGRESSION XP ────────────────────────────────────────
  const barWidth = 650;
  const barHeight = 30;
  const barX = 250;
  const barY = 180;

  // Fond barre
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(barX, barY, barWidth, barHeight);

  // Barre de progression
  const xpPercent = Math.min((userStats.xp / userStats.nextLevelXP), 1);
  ctx.fillStyle = accentColor;
  ctx.fillRect(barX, barY, barWidth * xpPercent, barHeight);

  // Border barre
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  // Texte XP
  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${userStats.xp} / ${userStats.nextLevelXP} XP`, barX + 15, barY + 22);

  // ── STATS EN COLONNES ──────────────────────────────────────────────
  const stats = [
    { label: 'Rank', value: `#${userStats.rank}`, icon: '🏆' },
    { label: 'XP', value: `${userStats.totalXP}`, icon: '⭐' },
    { label: 'Messages', value: `${userStats.messages}`, icon: '💬' },
    { label: 'Vocal', value: `${userStats.voiceTime}h`, icon: '🎤' }
  ];

  const statBoxWidth = 160;
  const statBoxHeight = 140;
  const statStartX = 250;
  const statStartY = 280;
  const statGapX = 180;

  stats.forEach((stat, index) => {
    const x = statStartX + index * statGapX;
    const y = statStartY;

    // Box
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x, y, statBoxWidth, statBoxHeight);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, statBoxWidth, statBoxHeight);

    // Icon
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = accentColor;
    ctx.textAlign = 'center';
    ctx.fillText(stat.icon, x + statBoxWidth / 2, y + 45);

    // Label
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#aaaaaa';
    ctx.textAlign = 'center';
    ctx.fillText(stat.label, x + statBoxWidth / 2, y + 75);

    // Value
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(stat.value, x + statBoxWidth / 2, y + 110);
  });

  // ── FOOTER ─────────────────────────────────────────────────────────
  ctx.font = '14px Arial';
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'left';
  ctx.fillText(`Ministre de la Singerie™`, 250, 570);

  return canvas.toBuffer('image/png');
}

module.exports = { generateStatsImage };
