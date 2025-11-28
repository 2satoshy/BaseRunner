
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

// The full phrase to collect across all levels
// "GEMINI IS THE QUICK BROWN FOX THAT JUMPS OVER THE LAZY AI DOG"
const FULL_PHRASE = "GEMINI IS THE QUICK BROWN FOX THAT JUMPS OVER THE LAZY AI DOG";
const PHRASE_LETTERS = FULL_PHRASE.split('').filter(c => c !== ' '); // Remove spaces

// Each level requires collecting a portion of the phrase
const LETTERS_PER_LEVEL = 6; // Collect 6 letters per level
const MAX_LEVEL = 30; // 30 levels for extended gameplay
const POWERUP_DURATION = 10000; // 10 seconds

// Speed Constants
const START_SPEED = RUN_SPEED_BASE * 0.5; // Start at 50%
const SPEED_INCREMENT_PER_100 = 0.08; // 8% increase per 100 points (slightly reduced for longer game)

// Level completion bonus (increases per level)
const LEVEL_BONUS_BASE = 500;

// Helper function to get which letters need to be collected for a given level
// Returns indices into PHRASE_LETTERS that are NOT yet collected
// Includes: 1) Letters assigned to this level 2) Carryover from previous levels
const getLevelLetterIndices = (level: number, collectedLetters: number[]): number[] => {
  // Calculate the range of letters for this level
  const levelStartIndex = (level - 1) * LETTERS_PER_LEVEL;
  const levelEndIndex = Math.min(levelStartIndex + LETTERS_PER_LEVEL, PHRASE_LETTERS.length);
  
  // Get letters from all levels up to and including current level that aren't collected
  const availableIndices: number[] = [];
  for (let i = 0; i < levelEndIndex; i++) {
    if (!collectedLetters.includes(i)) {
      availableIndices.push(i);
    }
  }
  return availableIndices;
};

// Export for use in LevelManager
export { PHRASE_LETTERS, LETTERS_PER_LEVEL, MAX_LEVEL, getLevelLetterIndices };

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
    
    // Index is the absolute position in PHRASE_LETTERS
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

      // Check if all phrase letters collected
      if (newLetters.length === PHRASE_LETTERS.length) {
        set((state) => ({
            status: GameStatus.VICTORY,
            score: state.score + 10000,
            totalScore: state.totalScore + 10000,
            speed: calculateSpeed(state.totalScore + 10000)
        }));
      } else {
        // Check if current level's letters are all collected
        const levelLetters = getLevelLetterIndices(level, newLetters);
        if (levelLetters.length === 0 && level < MAX_LEVEL) {
          // All letters for this level collected (including carryovers), advance
          get().advanceLevel();
        }
      }
    }
  },

  advanceLevel: () => {
      const { level, laneCount, score, totalScore, collectedLetters } = get();
      const nextLevel = level + 1;
      
      // Level completion bonus (increases per level)
      const levelBonus = LEVEL_BONUS_BASE * level;
      
      // Add bonus lanes more gradually (max 9 lanes)
      const newLaneCount = Math.min(3 + Math.floor((nextLevel - 1) / 2) * 2, 9);
      
      // Keep collectedLetters - uncollected ones carry over automatically
      set({
          level: nextLevel,
          laneCount: newLaneCount, 
          status: GameStatus.PLAYING, 
          // Don't reset collectedLetters - they persist!
          score: score + levelBonus,
          totalScore: totalScore + levelBonus,
          speed: calculateSpeed(totalScore + levelBonus)
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
