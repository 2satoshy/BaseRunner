import { Router } from 'express';
import authRoutes from './auth';
import leaderboardRoutes from './leaderboard';
import userRoutes from './user';

const router = Router();

router.use('/auth', authRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/user', userRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
