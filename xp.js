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

const MIGRATION_DATA = {
  "1284974661528064050": { username: "Miaw", xp: 66990, level: 76 },
  "1230235113766391879": { username: "Trauchmar", xp: 75440, level: 82 },
  "1230412444292350013": { username: "halibel", xp: 40338, level: 58 },
  "1324739974939148368": { username: "Mr J", xp: 34790, level: 53 },
  "1230567599180353587": { username: "Gorgeous Nayoul", xp: 51458, level: 66 },
  "1481004807689863369": { username: "🧁𖦹ᒪᑌᑎᗩ 𖦹⭐", xp: 4771, level: 17 },
  "1217486944099897375": { username: "nucleardorfus", xp: 34, level: 1 },
  "1341455264553107477": { username: "Laslo", xp: 13875, level: 32 },
  "702700251261435965": { username: "chloey3286", xp: 360, level: 4 },
  "1445453627610234900": { username: "optiplex__46488", xp: 540, level: 5 },
  "1312836347177730169": { username: "۞Ziotox🔥", xp: 64795, level: 75 },
  "1309057943034925079": { username: "OOgaBooBoo", xp: 7656, level: 23 },
  "1166831956185591930": { username: "alloselem190🐒🦧🦧", xp: 11176, level: 28 },
  "1405143308434538547": { username: "92i_loverdeblxfrt", xp: 2000, level: 10 },
  "1319571339878862880": { username: "MHTG", xp: 0, level: 0 },
  "1270776301158141953": { username: "Soba ナズナ", xp: 360, level: 4 }
};

async function connectDB() {
  await connect();
  console.log('✅ Connecté à MongoDB');
  const miaw = await User.findOne({ userId: '1284974661528064050' });
  if (!miaw || miaw.xp < 66990) {
    for (const [userId, stats] of Object.entries(MIGRATION_DATA)) {
      await User.findOneAndUpdate(
        { userId },
        { userId, username: stats.username, xp: stats.xp, level: stats.level },
        { upsert: true }
      );
    }
    console.log('✅ Migration : 16 membres restaurés depuis xp_data.json');
  }
}

module.exports = { connectDB, addXP, removeXP, getStats, getLevel, xpForLevel, getLeaderboard, resetAll };
