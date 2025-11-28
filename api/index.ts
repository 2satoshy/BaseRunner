import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';

// MongoDB connection - optimized for serverless
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    console.log('Using cached MongoDB connection');
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not defined in environment');
    throw new Error('MONGODB_URI is not defined');
  }
  
  console.log('Connecting to MongoDB...');
  console.log('URI prefix:', uri.substring(0, 30) + '...');

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
      console.log('MongoDB connected successfully');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('MongoDB connection error:', e);
    throw e;
  }

  return cached.conn;
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
      mongoConnected: mongoose.connection.readyState === 1,
    });
  } catch (error: any) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      error: 'Database connection failed',
      details: error.message || 'Unknown error',
      hasUri: !!process.env.MONGODB_URI,
    });
  }
}
