import { Router, Response } from 'express';
import { User } from '../models';
import { AuthRequest, verifyToken } from '../middleware/auth';

const router = Router();

// GET /api/user/profile - Get user profile
router.get('/profile', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ walletAddress: req.user?.walletAddress });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      profile: {
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
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// PUT /api/user/inventory - Update user inventory (after purchases)
router.put('/inventory', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { hasDoubleJump, hasImmortality, maxLives } = req.body;

    const updateFields: Record<string, unknown> = {};
    
    if (typeof hasDoubleJump === 'boolean') {
      updateFields['inventory.hasDoubleJump'] = hasDoubleJump;
    }
    if (typeof hasImmortality === 'boolean') {
      updateFields['inventory.hasImmortality'] = hasImmortality;
    }
    if (typeof maxLives === 'number' && maxLives >= 3 && maxLives <= 10) {
      updateFields['inventory.maxLives'] = maxLives;
    }

    const user = await User.findOneAndUpdate(
      { walletAddress: req.user?.walletAddress },
      { $set: updateFields },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      inventory: user.inventory,
    });
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// POST /api/user/achievement - Add achievement
router.post('/achievement', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { achievement } = req.body;

    if (!achievement || typeof achievement !== 'string') {
      res.status(400).json({ error: 'Invalid achievement' });
      return;
    }

    const user = await User.findOneAndUpdate(
      { walletAddress: req.user?.walletAddress },
      { $addToSet: { achievements: achievement } },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      achievements: user.achievements,
    });
  } catch (error) {
    console.error('Add achievement error:', error);
    res.status(500).json({ error: 'Failed to add achievement' });
  }
});

// GET /api/user/stats - Get user statistics
router.get('/stats', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ walletAddress: req.user?.walletAddress });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Calculate victories from game history
    const victories = user.gameHistory?.filter(g => g.outcome === 'victory').length || 0;

    res.json({
      stats: {
        totalGamesPlayed: user.totalGamesPlayed,
        highestScore: user.highestScore,
        highestLevel: user.highestLevel || 0,
        totalGemsCollected: user.totalGemsCollected,
        totalDistance: user.totalDistance || 0,
        victories,
        achievementsCount: user.achievements.length,
        accountAge: Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)), // days
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/user/history - Get game history
router.get('/history', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    
    const user = await User.findOne({ walletAddress: req.user?.walletAddress });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get most recent games first
    const history = (user.gameHistory || [])
      .slice(-limit)
      .reverse()
      .map((game, index) => ({
        id: index,
        score: game.score,
        level: game.level,
        gemsCollected: game.gemsCollected,
        distance: game.distance,
        outcome: game.outcome,
        playedAt: game.playedAt,
      }));

    res.json({
      history,
      totalGames: user.totalGamesPlayed,
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get game history' });
  }
});

export default router;
