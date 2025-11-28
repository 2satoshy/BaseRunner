import { Router, Response } from 'express';
import { Leaderboard, User } from '../models';
import { AuthRequest, verifyToken, optionalAuth } from '../middleware/auth';

const router = Router();

// GET /api/leaderboard - Get top scores
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const skip = (page - 1) * limit;

    const entries = await Leaderboard.find()
      .sort({ score: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('username score level gemsCollected distance createdAt walletAddress');

    const total = await Leaderboard.countDocuments();

    res.json({
      entries: entries.map((entry, index) => ({
        rank: skip + index + 1,
        username: entry.username,
        score: entry.score,
        level: entry.level,
        gemsCollected: entry.gemsCollected,
        distance: entry.distance,
        walletAddress: `${entry.walletAddress.slice(0, 6)}...${entry.walletAddress.slice(-4)}`,
        createdAt: entry.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// GET /api/leaderboard/top - Get top 5 for display
router.get('/top', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entries = await Leaderboard.find()
      .sort({ score: -1, createdAt: -1 })
      .limit(5)
      .select('username score createdAt');

    res.json({
      entries: entries.map((entry, index) => ({
        rank: index + 1,
        name: entry.username,
        score: entry.score,
        date: entry.createdAt.getTime(),
      })),
    });
  } catch (error) {
    console.error('Get top leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// POST /api/leaderboard/submit - Submit a new score (requires auth)
router.post('/submit', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { score, level, gemsCollected, distance, username, outcome } = req.body;

    if (typeof score !== 'number' || score < 0) {
      res.status(400).json({ error: 'Invalid score' });
      return;
    }

    const walletAddress = req.user?.walletAddress;
    if (!walletAddress) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
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

    // Update user stats and add to game history
    const user = await User.findOne({ walletAddress });
    if (user) {
      user.totalGamesPlayed += 1;
      user.totalGemsCollected += gemsCollected || 0;
      user.totalDistance += distance || 0;
      
      if (score > user.highestScore) {
        user.highestScore = score;
      }
      if ((level || 1) > user.highestLevel) {
        user.highestLevel = level || 1;
      }

      // Add to game history (keep last 50 games)
      user.gameHistory.push({
        score,
        level: level || 1,
        gemsCollected: gemsCollected || 0,
        distance: distance || 0,
        playedAt: new Date(),
        outcome: outcome === 'victory' ? 'victory' : 'game_over',
      });

      // Keep only last 50 games
      if (user.gameHistory.length > 50) {
        user.gameHistory = user.gameHistory.slice(-50);
      }

      // Check for achievements
      const newAchievements: string[] = [];
      
      if (user.totalGamesPlayed === 1 && !user.achievements.includes('FIRST_RUN')) {
        newAchievements.push('FIRST_RUN');
      }
      if (score >= 10000 && !user.achievements.includes('SCORE_10K')) {
        newAchievements.push('SCORE_10K');
      }
      if (score >= 50000 && !user.achievements.includes('SCORE_50K')) {
        newAchievements.push('SCORE_50K');
      }
      if (level >= 3 && !user.achievements.includes('LEVEL_3')) {
        newAchievements.push('LEVEL_3');
      }
      if (outcome === 'victory' && !user.achievements.includes('VICTORY')) {
        newAchievements.push('VICTORY');
      }
      if (user.totalGamesPlayed >= 10 && !user.achievements.includes('DEDICATED_RUNNER')) {
        newAchievements.push('DEDICATED_RUNNER');
      }
      if (user.totalGemsCollected >= 1000 && !user.achievements.includes('GEM_COLLECTOR')) {
        newAchievements.push('GEM_COLLECTOR');
      }

      if (newAchievements.length > 0) {
        user.achievements.push(...newAchievements);
      }

      await user.save();
    }

    // Get rank
    const rank = await Leaderboard.countDocuments({ score: { $gt: score } }) + 1;

    // Check if it's a top 5 score
    const isTopScore = rank <= 5;

    res.json({
      success: true,
      entry: {
        id: entry._id,
        rank,
        score: entry.score,
        isTopScore,
      },
    });
  } catch (error) {
    console.error('Submit score error:', error);
    res.status(500).json({ error: 'Failed to submit score' });
  }
});

// GET /api/leaderboard/rank/:score - Check rank for a score
router.get('/rank/:score', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const score = parseInt(req.params.score);
    
    if (isNaN(score) || score < 0) {
      res.status(400).json({ error: 'Invalid score' });
      return;
    }

    const rank = await Leaderboard.countDocuments({ score: { $gt: score } }) + 1;
    const total = await Leaderboard.countDocuments();
    const isTopFive = rank <= 5;

    res.json({
      rank,
      total,
      isTopFive,
      percentile: total > 0 ? Math.round((1 - (rank - 1) / total) * 100) : 100,
    });
  } catch (error) {
    console.error('Get rank error:', error);
    res.status(500).json({ error: 'Failed to get rank' });
  }
});

// GET /api/leaderboard/user/:address - Get user's scores
router.get('/user/:address', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { address } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const entries = await Leaderboard.find({ walletAddress: address.toLowerCase() })
      .sort({ score: -1, createdAt: -1 })
      .limit(limit)
      .select('score level gemsCollected distance createdAt');

    const bestScore = entries.length > 0 ? entries[0].score : 0;
    const bestRank = bestScore > 0 
      ? await Leaderboard.countDocuments({ score: { $gt: bestScore } }) + 1 
      : null;

    res.json({
      entries,
      stats: {
        totalGames: entries.length,
        bestScore,
        bestRank,
      },
    });
  } catch (error) {
    console.error('Get user scores error:', error);
    res.status(500).json({ error: 'Failed to get user scores' });
  }
});

export default router;
