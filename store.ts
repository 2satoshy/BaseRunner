
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { create } from 'zustand';
import { GameStatus, RUN_SPEED_BASE, LeaderboardEntry, BaseAccountUser } from './types';
import { api, UserData } from './services/api';

interface GameState {
  status: GameStatus;
  score: number;
  totalScore: number; // Cumulative score for speed calculation
  lives: number;
  maxLives: number;
  speed: number;
  collectedLetters: number[]; 
  level: number;
  laneCount: number;
  gemsCollected: number;
  distance: number;
  
  // Inventory / Abilities
  hasDoubleJump: boolean;
  hasImmortality: boolean;
  isImmortalityActive: boolean;

  // Powerups (Timers)
  magnetEndTime: number;
  shieldEndTime: number;

  // Leaderboard
  leaderboard: LeaderboardEntry[];

  // Base Account Authentication
  baseAccount: BaseAccountUser | null;
  authToken: string | null;
  userData: UserData | null;
  isAuthenticated: boolean;

  // Actions
  startGame: () => void;
  restartGame: () => void;
  takeDamage: () => void;
  addScore: (amount: number) => void;
  collectGem: (value: number) => void;
  collectLetter: (index: number) => void;
  setStatus: (status: GameStatus) => void;
  setDistance: (dist: number) => void;
  
  // Shop / Abilities
  buyItem: (type: 'DOUBLE_JUMP' | 'MAX_LIFE' | 'HEAL' | 'IMMORTAL', cost: number) => boolean;
  advanceLevel: () => void;
  openShop: () => void;
  closeShop: () => void;
  activateImmortality: () => void;
  
  // Powerup Actions
  activateMagnet: () => void;
  activateShield: () => void;

  // Leaderboard Actions
  isHighScore: (score: number) => boolean;
  saveScore: (name: string) => Promise<void>;
  fetchLeaderboard: () => Promise<void>;

  // Base Account Actions
  setBaseAccount: (user: BaseAccountUser | null) => void;
  authenticateUser: (address: string, message?: string, signature?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  submitGameScore: () => Promise<void>;
  restoreSession: () => Promise<void>;
  isSessionLoading: boolean;
}

const GEMINI_TARGET = ['G', 'E', 'M', 'I', 'N', 'I'];
const MAX_LEVEL = 3;
const POWERUP_DURATION = 10000; // 10 seconds

// Speed Constants
const START_SPEED = RUN_SPEED_BASE * 0.5; // Start at 50%
const SPEED_INCREMENT_PER_100 = 0.1; // 10% increase

// Helper to safely load leaderboard
const loadLeaderboard = (): LeaderboardEntry[] => {
    try {
        const data = localStorage.getItem('gemini_runner_leaderboard');
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// Helper to calculate speed based on total points earned
const calculateSpeed = (totalScore: number) => {
    const increments = Math.floor(totalScore / 100);
    return START_SPEED * (1 + (increments * SPEED_INCREMENT_PER_100));
};

export const useStore = create<GameState>((set, get) => ({
  status: GameStatus.MENU,
  score: 0,
  totalScore: 0,
  lives: 3,
  maxLives: 3,
  speed: 0,
  collectedLetters: [],
  level: 1,
  laneCount: 3,
  gemsCollected: 0,
  distance: 0,
  
  hasDoubleJump: false,
  hasImmortality: false,
  isImmortalityActive: false,
  
  magnetEndTime: 0,
  shieldEndTime: 0,

  leaderboard: loadLeaderboard(),

  baseAccount: null,
  authToken: api.getToken(),
  userData: null,
  isAuthenticated: false,
  isSessionLoading: true,

  startGame: () => {
    const { isAuthenticated } = get();
    if (!isAuthenticated) {
      console.warn('Cannot start game without authentication');
      return;
    }
    set({ 
      status: GameStatus.PLAYING, 
      score: 0, 
      totalScore: 0,
      lives: 3, 
      maxLives: 3,
      speed: START_SPEED,
      collectedLetters: [],
      level: 1,
      laneCount: 3,
      gemsCollected: 0,
      distance: 0,
      hasDoubleJump: false,
      hasImmortality: false,
      isImmortalityActive: false,
      magnetEndTime: 0,
      shieldEndTime: 0
    });
  },

  restartGame: () => {
    const { isAuthenticated } = get();
    if (!isAuthenticated) {
      console.warn('Cannot restart game without authentication');
      return;
    }
    set({ 
      status: GameStatus.PLAYING, 
      score: 0, 
      totalScore: 0,
      lives: 3, 
      maxLives: 3,
      speed: START_SPEED,
      collectedLetters: [],
      level: 1,
      laneCount: 3,
      gemsCollected: 0,
      distance: 0,
      hasDoubleJump: false,
      hasImmortality: false,
      isImmortalityActive: false,
      magnetEndTime: 0,
      shieldEndTime: 0
    });
  },

  takeDamage: () => {
    const { lives, isImmortalityActive, shieldEndTime } = get();
    // No damage if Skill Active OR Shield Powerup Active
    if (isImmortalityActive || Date.now() < shieldEndTime) return; 

    if (lives > 1) {
      set({ lives: lives - 1 });
    } else {
      set({ lives: 0, status: GameStatus.GAME_OVER, speed: 0 });
    }
  },

  addScore: (amount) => set((state) => {
      const newScore = state.score + amount;
      const newTotal = state.totalScore + amount;
      return { 
          score: newScore,
          totalScore: newTotal,
          speed: calculateSpeed(newTotal)
      };
  }),
  
  collectGem: (value) => set((state) => {
    const newScore = state.score + value;
    const newTotal = state.totalScore + value;
    return { 
        score: newScore, 
        totalScore: newTotal,
        gemsCollected: state.gemsCollected + 1,
        speed: calculateSpeed(newTotal) 
    };
  }),

  setDistance: (dist) => set({ distance: dist }),

  collectLetter: (index) => {
    const { collectedLetters, level } = get();
    
    if (!collectedLetters.includes(index)) {
      const newLetters = [...collectedLetters, index];
      const points = 100; // Award points for letters to contribute to speed

      set((state) => {
          const newScore = state.score + points;
          const newTotal = state.totalScore + points;
          return { 
            collectedLetters: newLetters,
            score: newScore,
            totalScore: newTotal,
            speed: calculateSpeed(newTotal)
          };
      });

      // Check if full word collected
      if (newLetters.length === GEMINI_TARGET.length) {
        if (level < MAX_LEVEL) {
            get().advanceLevel();
        } else {
            set((state) => ({
                status: GameStatus.VICTORY,
                score: state.score + 5000,
                totalScore: state.totalScore + 5000,
                // Victory speed calc optional, but consistent
                speed: calculateSpeed(state.totalScore + 5000)
            }));
        }
      }
    }
  },

  advanceLevel: () => {
      const { level, laneCount } = get();
      const nextLevel = level + 1;
      
      // Speed is now purely score-driven, no artificial boost on level up.
      
      set({
          level: nextLevel,
          laneCount: Math.min(laneCount + 2, 9), 
          status: GameStatus.PLAYING, 
          collectedLetters: [] 
      });
  },

  openShop: () => set({ status: GameStatus.SHOP }),
  
  closeShop: () => set({ status: GameStatus.PLAYING }),

  buyItem: (type, cost) => {
      const { score, maxLives, lives } = get();
      
      if (score >= cost) {
          // Note: Buying items reduces spendable score but NOT totalScore.
          // This prevents the game from slowing down when you buy items.
          set({ score: score - cost });
          
          switch (type) {
              case 'DOUBLE_JUMP':
                  set({ hasDoubleJump: true });
                  break;
              case 'MAX_LIFE':
                  set({ maxLives: maxLives + 1, lives: lives + 1 });
                  break;
              case 'HEAL':
                  set({ lives: Math.min(lives + 1, maxLives) });
                  break;
              case 'IMMORTAL':
                  set({ hasImmortality: true });
                  break;
          }
          return true;
      }
      return false;
  },

  activateImmortality: () => {
      const { hasImmortality, isImmortalityActive } = get();
      if (hasImmortality && !isImmortalityActive) {
          set({ isImmortalityActive: true });
          
          setTimeout(() => {
              set({ isImmortalityActive: false });
          }, 5000);
      }
  },

  activateMagnet: () => set({ magnetEndTime: Date.now() + POWERUP_DURATION }),
  activateShield: () => set({ shieldEndTime: Date.now() + POWERUP_DURATION }),

  setStatus: (status) => set({ status }),

  isHighScore: (score) => {
      const { leaderboard } = get();
      if (score <= 0) return false;
      if (leaderboard.length < 5) return true;
      return score > leaderboard[leaderboard.length - 1].score;
  },

  saveScore: async (name) => {
      const state = get();
      const newEntry: LeaderboardEntry = { name, score: state.score, date: Date.now() };
      
      // Update local leaderboard immediately
      const newBoard = [...state.leaderboard, newEntry]
         .sort((a, b) => b.score - a.score)
         .slice(0, 5);
      
      localStorage.setItem('gemini_runner_leaderboard', JSON.stringify(newBoard));
      set({ leaderboard: newBoard });

      // Submit to server if authenticated
      if (state.isAuthenticated) {
        try {
          await api.submitScore({
            score: state.score,
            level: state.level,
            gemsCollected: state.gemsCollected,
            distance: Math.floor(state.distance),
            username: name,
          });
        } catch (error) {
          console.error('Failed to submit score to server:', error);
        }
      }
  },

  fetchLeaderboard: async () => {
    try {
      const result = await api.getTopLeaderboard();
      if (result.data?.entries) {
        const entries: LeaderboardEntry[] = result.data.entries.map(e => ({
          name: e.name,
          score: e.score,
          date: e.date,
        }));
        set({ leaderboard: entries });
        localStorage.setItem('gemini_runner_leaderboard', JSON.stringify(entries));
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  },

  setBaseAccount: (user) => set({ baseAccount: user }),

  authenticateUser: async (address, message, signature) => {
    try {
      let result;
      
      if (message && signature) {
        // Full SIWE authentication
        result = await api.verifyAuth(address, message, signature);
      } else {
        // Quick auth for development
        result = await api.quickAuth(address);
      }

      if (result.data?.success && result.data.user) {
        // Save wallet address to localStorage for session restore
        localStorage.setItem('baserunner_wallet', address.toLowerCase());
        
        set({
          isAuthenticated: true,
          isSessionLoading: false,
          authToken: result.data.token,
          userData: result.data.user,
          baseAccount: { address, isConnected: true },
        });
        
        // Fetch leaderboard after auth
        get().fetchLeaderboard();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  },

  logout: async () => {
    await api.logout();
    localStorage.removeItem('baserunner_wallet');
    set({
      isAuthenticated: false,
      authToken: null,
      userData: null,
      baseAccount: null,
      status: GameStatus.MENU,
    });
  },

  restoreSession: async () => {
    const token = api.getToken();
    const savedWallet = localStorage.getItem('baserunner_wallet');
    
    if (!token) {
      set({ isSessionLoading: false, isAuthenticated: false });
      return;
    }

    try {
      // Try to get current user data from the server
      const result = await api.getMe();
      
      if (result.data?.user) {
        set({
          isAuthenticated: true,
          isSessionLoading: false,
          userData: result.data.user,
          baseAccount: savedWallet ? { address: savedWallet, isConnected: true } : null,
        });
        
        // Fetch leaderboard
        get().fetchLeaderboard();
      } else {
        // Token invalid, clear session
        api.logout();
        localStorage.removeItem('baserunner_wallet');
        set({
          isAuthenticated: false,
          isSessionLoading: false,
          authToken: null,
          userData: null,
          baseAccount: null,
        });
      }
    } catch (error) {
      console.error('Session restore error:', error);
      // Clear invalid session
      api.logout();
      localStorage.removeItem('baserunner_wallet');
      set({
        isAuthenticated: false,
        isSessionLoading: false,
        authToken: null,
        userData: null,
        baseAccount: null,
      });
    }
  },

  submitGameScore: async () => {
    const state = get();
    if (!state.isAuthenticated || state.score <= 0) return;

    try {
      await api.submitScore({
        score: state.score,
        level: state.level,
        gemsCollected: state.gemsCollected,
        distance: Math.floor(state.distance),
        username: state.userData?.username || `Runner_${state.baseAccount?.address.slice(2, 8)}`,
        outcome: state.status === GameStatus.VICTORY ? 'victory' : 'game_over',
      });
      
      // Refresh leaderboard
      await get().fetchLeaderboard();
    } catch (error) {
      console.error('Failed to submit game score:', error);
    }
  },
}));
