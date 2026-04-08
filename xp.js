const fs = require('fs');
const DB_FILE = './xp_data.json';

function loadData() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function xpForLevel(level) {
  return Math.floor(27 * Math.pow(level, 1.8));
}

function getLevel(xp) {
  let level = 0;
  while (xp >= xpForLevel(level + 1)) level++;
  return Math.min(level, 100);
}

function addXP(userId, username, amount) {
  const data = loadData();
  if (!data[userId]) data[userId] = { username, xp: 0, level: 0 };
  data[userId].username = username;
  const oldLevel = data[userId].level;
  data[userId].xp += amount;
  const newLevel = getLevel(data[userId].xp);
  data[userId].level = newLevel;
  saveData(data);
  return { xp: data[userId].xp, level: newLevel, leveledUp: newLevel > oldLevel };
}

function removeXP(userId, amount) {
  const data = loadData();
  if (!data[userId]) return null;
  data[userId].xp = Math.max(0, data[userId].xp - amount);
  data[userId].level = getLevel(data[userId].xp);
  saveData(data);
  return { xp: data[userId].xp, level: data[userId].level };
}

function getStats(userId) {
  const data = loadData();
  return data[userId] || null;
}

function getLeaderboard() {
  const data = loadData();
  return Object.entries(data)
    .sort((a, b) => b[1].xp - a[1].xp)
    .slice(0, 10);
}

function resetAll() {
  saveData({});
}

module.exports = { addXP, removeXP, getStats, getLevel, xpForLevel, getLeaderboard, resetAll };
