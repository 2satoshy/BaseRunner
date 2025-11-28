// API Service for BaseRunner
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (this.token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Request failed' };
      }

      return { data };
    } catch (error) {
      console.error('API request error:', error);
      return { error: 'Network error' };
    }
  }

  // Auth endpoints
  async verifyAuth(address: string, message: string, signature: string) {
    const result = await this.request<{
      success: boolean;
      token: string;
      user: UserData;
    }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ address, message, signature }),
    });

    if (result.data?.token) {
      this.setToken(result.data.token);
    }

    return result;
  }

  async quickAuth(address: string) {
    const result = await this.request<{
      success: boolean;
      token: string;
      user: UserData;
    }>('/auth/quick-auth', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });

    if (result.data?.token) {
      this.setToken(result.data.token);
    }

    return result;
  }

  async getMe() {
    return this.request<{ user: UserData }>('/auth/me');
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
    return this.request<{
      entries: { rank: number; name: string; score: number; date: number }[];
    }>('/leaderboard/top');
  }

  async submitScore(data: {
    score: number;
    level: number;
    gemsCollected: number;
    distance: number;
    username?: string;
    outcome?: 'game_over' | 'victory';
  }) {
    return this.request<{
      success: boolean;
      entry: {
        id: string;
        rank: number;
        score: number;
        isTopScore: boolean;
      };
    }>('/leaderboard/submit', {
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
