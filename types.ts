
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  SHOP = 'SHOP',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum ObjectType {
  OBSTACLE = 'OBSTACLE',
  GEM = 'GEM',
  LETTER = 'LETTER',
  SHOP_PORTAL = 'SHOP_PORTAL',
  ALIEN = 'ALIEN',
  MISSILE = 'MISSILE',
  MAGNET = 'MAGNET',
  SHIELD = 'SHIELD',
  DRONE = 'DRONE',
  // New obstacle types for variety
  LASER_GATE = 'LASER_GATE',     // Horizontal laser beam - must jump over
  BARRIER = 'BARRIER',           // Moving side-to-side barrier
  SPIKE_FLOOR = 'SPIKE_FLOOR',   // Floor spikes - must jump
  TURRET = 'TURRET',             // Shoots projectiles at player
  JUMP_PAD = 'JUMP_PAD',         // Bounces player high
  SPEED_BOOST = 'SPEED_BOOST'    // Temporary speed boost pickup
}

export interface GameObject {
  id: string;
  type: ObjectType;
  position: [number, number, number]; // x, y, z
  active: boolean;
  value?: string; // For letters (G, E, M...)
  color?: string;
  targetIndex?: number; // Index in the GEMINI target word
  points?: number; // Score value for gems
  hasFired?: boolean; // For Aliens/Turrets
  moveDirection?: number; // For moving barriers (-1 or 1)
  moveSpeed?: number; // For moving objects
  laserActive?: boolean; // For laser gates (toggling)
}

export interface LeaderboardEntry {
    name: string;
    score: number;
    date: number;
}

export interface BaseAccountUser {
    address: string;
    isConnected: boolean;
}

export const LANE_WIDTH = 2.2;
export const JUMP_HEIGHT = 2.5;
export const JUMP_DURATION = 0.6; // seconds
export const RUN_SPEED_BASE = 22.5;
export const SPAWN_DISTANCE = 120;
export const REMOVE_DISTANCE = 20; // Behind player

// Google-ish Neon Colors: Blue, Red, Yellow, Blue, Green, Red
export const GEMINI_COLORS = [
    '#2979ff', // G - Blue
    '#ff1744', // E - Red
    '#ffea00', // M - Yellow
    '#2979ff', // I - Blue
    '#00e676', // N - Green
    '#ff1744', // I - Red
];

export interface ShopItem {
    id: string;
    name: string;
    description: string;
    cost: number;
    icon: any; // Lucide icon component
    oneTime?: boolean; // If true, remove from pool after buying
}
