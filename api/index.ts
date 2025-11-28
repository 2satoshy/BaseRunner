import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';

// MongoDB connection
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined');
  }
  
  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

// User Schema
const userSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true, lowercase: true, index: true },
  username: { type: String, required: true, maxlength: 20 },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
  totalGamesPlayed: { type: Number, default: 0 },
  highestScore: { type: Number, default: 0 },
  highestLevel: { type: Number, default: 0 },
  totalGemsCollected: { type: Number, default: 0 },
  totalDistance: { type: Number, default: 0 },
  achievements: [{ type: String }],
  inventory: {
    hasDoubleJump: { type: Boolean, default: false },
    hasImmortality: { type: Boolean, default: false },
    maxLives: { type: Number, default: 3 },
  },
  sessions: [{
    token: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String },
    ipAddress: { type: String },
  }],
  gameHistory: [{
    score: { type: Number, required: true },
    level: { type: Number, required: true },
    gemsCollected: { type: Number, default: 0 },
    distance: { type: Number, default: 0 },
    playedAt: { type: Date, default: Date.now },
    outcome: { type: String, enum: ['game_over', 'victory'], default: 'game_over' },
  }],
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

// Leaderboard Schema
const leaderboardSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, lowercase: true, index: true },
  username: { type: String, required: true },
  score: { type: Number, required: true, index: true },
  level: { type: Number, default: 1 },
  gemsCollected: { type: Number, default: 0 },
  distance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const Leaderboard = mongoose.models.Leaderboard || mongoose.model('Leaderboard', leaderboardSchema);

export { connectDB, User, Leaderboard };

// Health check handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    await connectDB();
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'BaseRunner API is running',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Database connection failed' });
  }
}
