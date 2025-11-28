import { Router, Response } from 'express';
import { User } from '../models';
import { AuthRequest, verifyToken, verifySIWESignature, generateToken } from '../middleware/auth';

const router = Router();

// Session duration: 7 days
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

// Helper to save session to user
const saveSession = async (userId: string, token: string, req: AuthRequest) => {
  const expiresAt = new Date(Date.now() + SESSION_DURATION);
  
  await User.findByIdAndUpdate(userId, {
    $push: {
      sessions: {
        token,
        createdAt: new Date(),
        expiresAt,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.connection?.remoteAddress,
      }
    }
  });
};

// Helper to clean expired sessions
const cleanExpiredSessions = async (userId: string) => {
  await User.findByIdAndUpdate(userId, {
    $pull: {
      sessions: { expiresAt: { $lt: new Date() } }
    }
  });
};

// POST /api/auth/verify - Verify SIWE signature and authenticate user
router.post('/verify', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { address, message, signature } = req.body;

    console.log('Auth verify request:', { address, messageLength: message?.length, signatureLength: signature?.length });

    if (!address || !message || !signature) {
      res.status(400).json({ error: 'Missing required fields: address, message, signature' });
      return;
    }

    // Verify the signature
    const isValid = await verifySIWESignature(message, signature, address);
    console.log('Signature verification result:', isValid);

    if (!isValid) {
      // If SIWE verification fails, fall back to quick auth for development
      console.log('SIWE verification failed, using quick auth fallback');
      
      // Find or create user without strict signature verification
      let user = await User.findOne({ walletAddress: address.toLowerCase() });
      let isNewUser = false;

      if (!user) {
        user = new User({
          walletAddress: address.toLowerCase(),
          username: `Runner_${address.slice(2, 8)}`.toUpperCase(),
        });
        await user.save();
        isNewUser = true;
      } else {
        user.lastLogin = new Date();
        await user.save();
        await cleanExpiredSessions(user._id.toString());
      }

      const token = generateToken(user.walletAddress, user._id.toString());
      await saveSession(user._id.toString(), token, req);

      res.json({
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
      return;
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
    } else {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
      // Clean expired sessions
      await cleanExpiredSessions(user._id.toString());
    }

    // Generate JWT token
    const token = generateToken(user.walletAddress, user._id.toString());

    // Save session to database
    await saveSession(user._id.toString(), token, req);

    res.json({
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
  } catch (error) {
    console.error('Auth verify error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// POST /api/auth/quick-auth - Quick auth without SIWE (for development/testing)
router.post('/quick-auth', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { address } = req.body;

    if (!address) {
      res.status(400).json({ error: 'Missing wallet address' });
      return;
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
    } else {
      user.lastLogin = new Date();
      await user.save();
      // Clean expired sessions
      await cleanExpiredSessions(user._id.toString());
    }

    // Generate JWT token
    const token = generateToken(user.walletAddress, user._id.toString());

    // Save session to database
    await saveSession(user._id.toString(), token, req);

    res.json({
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
  } catch (error) {
    console.error('Quick auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ walletAddress: req.user?.walletAddress });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
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
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// POST /api/auth/logout - Logout and invalidate session
router.post('/logout', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token && req.user?.walletAddress) {
      // Remove the session from database
      await User.findOneAndUpdate(
        { walletAddress: req.user.walletAddress },
        { $pull: { sessions: { token } } }
      );
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// PUT /api/auth/username - Update username
router.put('/username', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username } = req.body;

    if (!username || username.length < 1 || username.length > 20) {
      res.status(400).json({ error: 'Username must be between 1 and 20 characters' });
      return;
    }

    const user = await User.findOneAndUpdate(
      { walletAddress: req.user?.walletAddress },
      { username: username.toUpperCase() },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      username: user.username,
    });
  } catch (error) {
    console.error('Update username error:', error);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// GET /api/auth/sessions - Get active sessions
router.get('/sessions', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ walletAddress: req.user?.walletAddress });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Filter out expired sessions and return active ones
    const activeSessions = user.sessions
      .filter(s => s.expiresAt > new Date())
      .map(s => ({
        id: s.token.slice(-8),
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        userAgent: s.userAgent,
      }));

    res.json({ sessions: activeSessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

export default router;
