// API Service for BaseRunner
// Use relative /api path for Vercel serverless functions, or full URL for local development
// Detect production by checking if we're NOT on localhost
const isProduction = typeof window !== 'undefined' && 
  !window.location.hostname.includes('localhost') && 
  !window.location.hostname.includes('127.0.0.1');

const API_BASE_URL = isProduction 
  ? '/api' 
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');

// Debug logging
console.log('[API] Environment:', { isProduction, API_BASE_URL, hostname: typeof window !== 'undefined' ? window.location.hostname : 'server' });

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiService {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage on init
    this.token = localStorage.getItem('baserunner_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('baserunner_token', token);
    } else {
      localStorage.removeItem('baserunner_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('[API] Request:', { url, method: options.method || 'GET' });
    
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (this.token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();
      console.log('[API] Response:', { url, status: response.status, ok: response.ok });

      if (!response.ok) {
        return { error: data.error || 'Request failed' };
      }

      return { data };
    } catch (error) {
      console.error('[API] Request error:', { url, error });
      return { error: 'Network error' };
    }
  }

  // Auth endpoints
  async verifyAuth(address: string, message: string, signature: string) {
    // Use query param for Vercel serverless, path for local
    const endpoint = isProduction ? '/auth?action=verify' : '/auth/verify';
    const result = await this.request<{
      success: boolean;
      token: string;
      user: UserData;
    }>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ address, message, signature }),
    });

    if (result.data?.token) {
      this.setToken(result.data.token);
    }

    return result;
  }

  async quickAuth(address: string) {
    const endpoint = isProduction ? '/auth?action=quick-auth' : '/auth/quick-auth';
    const result = await this.request<{
      success: boolean;
      token: string;
      user: UserData;
    }>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ address }),
    });

    if (result.data?.token) {
      this.setToken(result.data.token);
    }

    return result;
  }

  async getMe() {
    const endpoint = isProduction ? '/auth?action=me' : '/auth/me';
    return this.request<{ user: UserData }>(endpoint);
  }

  async updateUsername(username: string) {
    return this.request<{ success: boolean; username: string }>('/auth/username', {
      method: 'PUT',
      body: JSON.stringify({ username }),
    });
  }

  // Leaderboard endpoints
  async getLeaderboard(page = 1, limit = 10) {
    return this.request<{
      entries: LeaderboardEntry[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/leaderboard?page=${page}&limit=${limit}`);
  }

  async getTopLeaderboard() {
    const endpoint = isProduction ? '/leaderboard?action=top' : '/leaderboard/top';
    return this.request<{
      entries: { rank: number; name: string; score: number; date: number }[];
    }>(endpoint);
  }

  async submitScore(data: {
    score: number;
    level: number;
    gemsCollected: number;
    distance: number;
    username?: string;
    outcome?: 'game_over' | 'victory';
  }) {
    const endpoint = isProduction ? '/leaderboard' : '/leaderboard/submit';
    return this.request<{
      success: boolean;
      entry: {
        id: string;
        rank: number;
        score: number;
        isTopScore: boolean;
      };
    }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async checkRank(score: number) {
    return this.request<{
      rank: number;
      total: number;
      isTopFive: boolean;
      percentile: number;
    }>(`/leaderboard/rank/${score}`);
  }

  async getUserScores(address: string) {
    return this.request<{
      entries: any[];
      stats: {
        totalGames: number;
        bestScore: number;
        bestRank: number | null;
      };
    }>(`/leaderboard/user/${address}`);
  }

  // User endpoints
  async getUserProfile() {
    return this.request<{ profile: UserData }>('/user/profile');
  }

  async updateInventory(inventory: {
    hasDoubleJump?: boolean;
    hasImmortality?: boolean;
    maxLives?: number;
  }) {
    return this.request<{
      success: boolean;
      inventory: {
        hasDoubleJump: boolean;
        hasImmortality: boolean;
        maxLives: number;
      };
    }>('/user/inventory', {
      method: 'PUT',
      body: JSON.stringify(inventory),
    });
  }

  async addAchievement(achievement: string) {
    return this.request<{
      success: boolean;
      achievements: string[];
    }>('/user/achievement', {
      method: 'POST',
      body: JSON.stringify({ achievement }),
    });
  }

  async getUserStats() {
    return this.request<{
      stats: {
        totalGamesPlayed: number;
        highestScore: number;
        highestLevel: number;
        totalGemsCollected: number;
        totalDistance: number;
        victories: number;
        achievementsCount: number;
        accountAge: number;
      };
    }>('/user/stats');
  }

  async getGameHistory(limit = 20) {
    return this.request<{
      history: {
        id: number;
        score: number;
        level: number;
        gemsCollected: number;
        distance: number;
        outcome: 'game_over' | 'victory';
        playedAt: string;
      }[];
      totalGames: number;
    }>(`/user/history?limit=${limit}`);
  }

  // Health check
  async healthCheck() {
    return this.request<{
      status: string;
      timestamp: string;
      uptime: number;
    }>('/health');
  }

  // Logout - invalidate session on server
  async logout() {
    // Try to invalidate session on server
    if (this.token) {
      try {
        await this.request('/auth/logout', { method: 'POST' });
      } catch (error) {
        console.error('Server logout error:', error);
      }
    }
    this.setToken(null);
  }

  // Get active sessions
  async getSessions() {
    return this.request<{
      sessions: {
        id: string;
        createdAt: string;
        expiresAt: string;
        userAgent?: string;
      }[];
    }>('/auth/sessions');
  }
}

// Types
export interface UserData {
  id: string;
  walletAddress: string;
  username: string;
  highestScore: number;
  totalGamesPlayed: number;
  totalGemsCollected: number;
  inventory: {
    hasDoubleJump: boolean;
    hasImmortality: boolean;
    maxLives: number;
  };
  achievements: string[];
  createdAt?: string;
  lastLogin?: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
  level: number;
  gemsCollected: number;
  distance: number;
  walletAddress: string;
  createdAt: string;
}

// Export singleton instance
export const api = new ApiService();
