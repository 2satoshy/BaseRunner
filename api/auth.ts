import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// MongoDB connection - optimized for serverless
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined');

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, { bufferCommands: false }).then((mongoose) => mongoose);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
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

// Generate JWT token
const generateToken = (walletAddress: string, userId: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  return jwt.sign({ walletAddress, userId }, secret, { expiresIn: '7d' });
};

// Verify JWT token
const verifyToken = (token: string) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  return jwt.verify(token, secret) as { walletAddress: string; userId: string };
};

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

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

    const { action } = req.query;

    // POST /api/auth?action=verify or /api/auth?action=quick-auth
    if (req.method === 'POST') {
      const { address, message, signature } = req.body;

      if (!address) {
        return res.status(400).json({ error: 'Missing wallet address' });
      }

      // Find or create user
      let user = await User.findOne({ walletAddress: address.toLowerCase() });
      let isNewUser = false;

      if (!user) {
        user = new User({
          walletAddress: address.toLowerCase(),
          username: `Runner_${address.slice(2, 8)}`.toUpperCase(),
        });
        await user.save();
        isNewUser = true;
        console.log('Created new user:', user.walletAddress);
      } else {
        user.lastLogin = new Date();
        await user.save();
        console.log('User logged in:', user.walletAddress);
      }

      // Generate JWT token
      const token = generateToken(user.walletAddress, user._id.toString());

      // Save session
      const expiresAt = new Date(Date.now() + SESSION_DURATION);
      await User.findByIdAndUpdate(user._id, {
        $push: {
          sessions: {
            token,
            createdAt: new Date(),
            expiresAt,
            userAgent: req.headers['user-agent'],
          }
        }
      });

      return res.status(200).json({
        success: true,
        token,
        isNewUser,
        user: {
          id: user._id,
          walletAddress: user.walletAddress,
          username: user.username,
          highestScore: user.highestScore,
          totalGamesPlayed: user.totalGamesPlayed,
          totalGemsCollected: user.totalGemsCollected,
          inventory: user.inventory,
          achievements: user.achievements,
        },
      });
    }

    // GET /api/auth?action=me
    if (req.method === 'GET' && action === 'me') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      const user = await User.findOne({ walletAddress: decoded.walletAddress });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        user: {
          id: user._id,
          walletAddress: user.walletAddress,
          username: user.username,
          highestScore: user.highestScore,
          totalGamesPlayed: user.totalGamesPlayed,
          totalGemsCollected: user.totalGemsCollected,
          inventory: user.inventory,
          achievements: user.achievements,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
        },
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
