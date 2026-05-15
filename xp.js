const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: String,
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);
let connected = false;

async function connect() {
  if (!connected) {
    await mongoose.connect(process.env.MONGODB_URI);
    connected = true;
  }
}

function xpForLevel(level) {
  return Math.floor(27 * Math.pow(level, 1.8));
}

function getLevel(xp) {
  let level = 0;
  while (xp >= xpForLevel(level + 1)) level++;
  return Math.min(level, 100);
}

async function addXP(userId, username, amount) {
  await connect();
  let user = await User.findOne({ userId });
  if (!user) user = new User({ userId, username, xp: 0, level: 0 });
  user.username = username;
  const oldLevel = user.level;
  user.xp += amount;
  user.level = getLevel(user.xp);
  await user.save();
  return { xp: user.xp, level: user.level, leveledUp: user.level > oldLevel };
}

async function removeXP(userId, amount) {
  await connect();
  const user = await User.findOne({ userId });
  if (!user) return null;
  user.xp = Math.max(0, user.xp - amount);
  user.level = getLevel(user.xp);
  await user.save();
  return { xp: user.xp, level: user.level };
}

async function getStats(userId) {
  await connect();
  const user = await User.findOne({ userId });
  if (!user) return null;
  return { username: user.username, xp: user.xp, level: user.level };
}

async function getLeaderboard() {
  await connect();
  const users = await User.find().sort({ xp: -1 }).limit(10);
  return users.map(u => [u.userId, { username: u.username, xp: u.xp, level: u.level }]);
}

async function resetAll() {
  await connect();
  await User.deleteMany({});
}

async function connectDB() {
  await connect();
  console.log('✅ Connecté à MongoDB');
}

async function connectDB() {
  await connect();
  console.log('✅ Connecté à MongoDB');
}

async function connectDB() {
  await connect();
  console.log('✅ Connecté à MongoDB');
}

module.exports = { connectDB, addXP, removeXP, getStats, getLevel, xpForLevel, getLeaderboard, resetAll };