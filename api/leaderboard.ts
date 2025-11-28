import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// MongoDB connection
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined');
  await mongoose.connect(uri);
  isConnected = true;
};

// Schemas
const userSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true, lowercase: true },
  username: { type: String, required: true },
  totalGamesPlayed: { type: Number, default: 0 },
  highestScore: { type: Number, default: 0 },
  highestLevel: { type: Number, default: 0 },
  totalGemsCollected: { type: Number, default: 0 },
  totalDistance: { type: Number, default: 0 },
  achievements: [{ type: String }],
  gameHistory: [{
    score: Number,
    level: Number,
    gemsCollected: Number,
    distance: Number,
    playedAt: Date,
    outcome: String,
  }],
});

const leaderboardSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, lowercase: true },
  username: { type: String, required: true },
  score: { type: Number, required: true },
  level: { type: Number, default: 1 },
  gemsCollected: { type: Number, default: 0 },
  distance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Leaderboard = mongoose.models.Leaderboard || mongoose.model('Leaderboard', leaderboardSchema);

// Verify JWT
const verifyToken = (token: string) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  return jwt.verify(token, secret) as { walletAddress: string; userId: string };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectDB();

    const { action } = req.query;

    // GET /api/leaderboard?action=top
    if (req.method === 'GET' && action === 'top') {
      const entries = await Leaderboard.find()
        .sort({ score: -1, createdAt: -1 })
        .limit(5)
        .select('username score createdAt');

      return res.status(200).json({
        entries: entries.map((entry: any, index: number) => ({
          rank: index + 1,
          name: entry.username,
          score: entry.score,
          date: entry.createdAt.getTime(),
        })),
      });
    }

    // GET /api/leaderboard (paginated list)
    if (req.method === 'GET') {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const skip = (page - 1) * limit;

      const entries = await Leaderboard.find()
        .sort({ score: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Leaderboard.countDocuments();

      return res.status(200).json({
        entries: entries.map((entry: any, index: number) => ({
          rank: skip + index + 1,
          username: entry.username,
          score: entry.score,
          level: entry.level,
          gemsCollected: entry.gemsCollected,
          distance: entry.distance,
          walletAddress: `${entry.walletAddress.slice(0, 6)}...${entry.walletAddress.slice(-4)}`,
          createdAt: entry.createdAt,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    // POST /api/leaderboard (submit score)
    if (req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      const walletAddress = decoded.walletAddress;

      const { score, level, gemsCollected, distance, username, outcome } = req.body;

      if (typeof score !== 'number' || score < 0) {
        return res.status(400).json({ error: 'Invalid score' });
      }

      // Create leaderboard entry
      const entry = new Leaderboard({
        walletAddress,
        username: username || `Runner_${walletAddress.slice(2, 8)}`,
        score,
        level: level || 1,
        gemsCollected: gemsCollected || 0,
        distance: distance || 0,
      });
      await entry.save();

      // Update user stats
      const user = await User.findOne({ walletAddress });
      if (user) {
        user.totalGamesPlayed += 1;
        user.totalGemsCollected += gemsCollected || 0;
        user.totalDistance += distance || 0;
        if (score > user.highestScore) user.highestScore = score;
        if ((level || 1) > user.highestLevel) user.highestLevel = level || 1;

        // Add to game history
        user.gameHistory.push({
          score,
          level: level || 1,
          gemsCollected: gemsCollected || 0,
          distance: distance || 0,
          playedAt: new Date(),
          outcome: outcome === 'victory' ? 'victory' : 'game_over',
        });

        if (user.gameHistory.length > 50) {
          user.gameHistory = user.gameHistory.slice(-50);
        }

        // Check achievements
        if (user.totalGamesPlayed === 1 && !user.achievements.includes('FIRST_RUN')) {
          user.achievements.push('FIRST_RUN');
        }
        if (score >= 10000 && !user.achievements.includes('SCORE_10K')) {
          user.achievements.push('SCORE_10K');
        }
        if (outcome === 'victory' && !user.achievements.includes('VICTORY')) {
          user.achievements.push('VICTORY');
        }

        await user.save();
      }

      const rank = await Leaderboard.countDocuments({ score: { $gt: score } }) + 1;

      return res.status(200).json({
        success: true,
        entry: { id: entry._id, rank, score: entry.score, isTopScore: rank <= 5 },
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
