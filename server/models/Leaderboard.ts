import mongoose, { Document, Schema } from 'mongoose';

export interface ILeaderboardEntry extends Document {
  walletAddress: string;
  username: string;
  score: number;
  level: number;
  gemsCollected: number;
  distance: number;
  createdAt: Date;
}

const leaderboardSchema = new Schema<ILeaderboardEntry>({
  walletAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true,
  },
  username: {
    type: String,
    required: true,
    maxlength: 20,
  },
  score: {
    type: Number,
    required: true,
    index: true,
  },
  level: {
    type: Number,
    required: true,
    default: 1,
  },
  gemsCollected: {
    type: Number,
    default: 0,
  },
  distance: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound index for efficient leaderboard queries
leaderboardSchema.index({ score: -1, createdAt: -1 });

export const Leaderboard = mongoose.model<ILeaderboardEntry>('Leaderboard', leaderboardSchema);
