import mongoose, { Document, Schema, CallbackWithoutResultAndOptionalError } from 'mongoose';

export interface IGameHistory {
  score: number;
  level: number;
  gemsCollected: number;
  distance: number;
  playedAt: Date;
  outcome: 'game_over' | 'victory';
}

export interface IUser extends Document {
  walletAddress: string;
  username: string;
  createdAt: Date;
  lastLogin: Date;
  totalGamesPlayed: number;
  highestScore: number;
  highestLevel: number;
  totalGemsCollected: number;
  totalDistance: number;
  achievements: string[];
  inventory: {
    hasDoubleJump: boolean;
    hasImmortality: boolean;
    maxLives: number;
  };
  sessions: {
    token: string;
    createdAt: Date;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }[];
  gameHistory: IGameHistory[];
}

const userSchema = new Schema<IUser>({
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true,
  },
  username: {
    type: String,
    required: true,
    maxlength: 20,
    default: function() {
      return `Runner_${this.walletAddress.slice(2, 8)}`;
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
  totalGamesPlayed: {
    type: Number,
    default: 0,
  },
  highestScore: {
    type: Number,
    default: 0,
  },
  highestLevel: {
    type: Number,
    default: 0,
  },
  totalGemsCollected: {
    type: Number,
    default: 0,
  },
  totalDistance: {
    type: Number,
    default: 0,
  },
  achievements: [{
    type: String,
  }],
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

// Update lastLogin on every save
userSchema.pre('save', function(this: IUser, next: CallbackWithoutResultAndOptionalError) {
  this.lastLogin = new Date();
  next();
});

export const User = mongoose.model<IUser>('User', userSchema);
