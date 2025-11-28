
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useEffect } from 'react';
import { Heart, Zap, Trophy, MapPin, Diamond, Rocket, ArrowUpCircle, Shield, Activity, PlusCircle, Play, ListOrdered, X, Magnet, Wallet, LogOut } from 'lucide-react';
import { useStore } from '../../store';
import { GameStatus, GEMINI_COLORS, ShopItem, RUN_SPEED_BASE, LeaderboardEntry } from '../../types';
import { audio } from '../System/Audio';
import { createBaseAccountSDK } from '@base-org/account';

// Initialize Base Account SDK
const baseSDK = createBaseAccountSDK({
  appName: 'BaseRunner',
  appLogoUrl: 'https://www.gstatic.com/aistudio/starter-apps/gemini_runner/gemini_runner.png',
});

// Available Shop Items
const SHOP_ITEMS: ShopItem[] = [
    {
        id: 'DOUBLE_JUMP',
        name: 'DOUBLE JUMP',
        description: 'Jump again in mid-air. Essential for high obstacles.',
        cost: 1000,
        icon: ArrowUpCircle,
        oneTime: true
    },
    {
        id: 'MAX_LIFE',
        name: 'MAX LIFE UP',
        description: 'Permanently adds a heart slot and heals you.',
        cost: 1500,
        icon: Activity
    },
    {
        id: 'HEAL',
        name: 'REPAIR KIT',
        description: 'Restores 1 Life point instantly.',
        cost: 1000,
        icon: PlusCircle
    },
    {
        id: 'IMMORTAL',
        name: 'IMMORTALITY',
        description: 'Unlock Ability: Press Space/Tap to be invincible for 5s.',
        cost: 3000,
        icon: Shield,
        oneTime: true
    }
];

// --- Sub Components ---

const ActivePowerups: React.FC = () => {
    const { shieldEndTime, magnetEndTime } = useStore();
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(interval);
    }, []);

    const shieldLeft = Math.max(0, Math.ceil((shieldEndTime - now) / 1000));
    const magnetLeft = Math.max(0, Math.ceil((magnetEndTime - now) / 1000));

    if (shieldLeft === 0 && magnetLeft === 0) return null;

    return (
        <div className="absolute top-24 left-4 flex flex-col space-y-2 z-50">
            {shieldLeft > 0 && (
                <div className="flex items-center bg-black/60 border border-cyan-500/50 rounded-lg p-2 animate-pulse">
                    <Shield className="w-6 h-6 text-cyan-400 mr-2" />
                    <div className="flex flex-col">
                        <span className="text-xs text-cyan-200 font-cyber">SHIELD</span>
                        <span className="text-lg font-bold text-white font-mono leading-none">{shieldLeft}s</span>
                    </div>
                </div>
            )}
            {magnetLeft > 0 && (
                <div className="flex items-center bg-black/60 border border-purple-500/50 rounded-lg p-2 animate-pulse">
                    <Magnet className="w-6 h-6 text-purple-400 mr-2" />
                    <div className="flex flex-col">
                        <span className="text-xs text-purple-200 font-cyber">MAGNET</span>
                        <span className="text-lg font-bold text-white font-mono leading-none">{magnetLeft}s</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const LeaderboardTable: React.FC<{ entries: LeaderboardEntry[] }> = ({ entries }) => (
    <div className="w-full max-w-md bg-black/80 border border-gray-800 rounded-xl p-4 md:p-6 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <h3 className="text-xl md:text-2xl text-cyan-400 font-cyber mb-4 text-center border-b border-gray-800 pb-2 tracking-widest">ELITE RUNNERS</h3>
        {entries.length === 0 ? (
             <div className="text-gray-500 text-center italic py-4">NO RECORDS YET</div>
        ) : (
            <div className="space-y-3">
                {entries.map((entry, idx) => (
                    <div key={idx} className={`flex justify-between items-center text-sm md:text-base p-2 rounded ${idx === 0 ? 'bg-yellow-900/20 text-yellow-400 font-bold border border-yellow-500/30' : 'text-gray-300 border-b border-gray-800'}`}>
                         <div className="flex items-center">
                             <span className={`w-8 font-mono text-center ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-gray-600'}`}>
                                 #{idx + 1}
                             </span>
                             <span className="font-mono tracking-wider ml-2">{entry.name}</span>
                         </div>
                         <span className="font-cyber">{entry.score.toLocaleString()}</span>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const HighScoreForm: React.FC<{ onSubmit: (name: string) => void }> = ({ onSubmit }) => {
    const [name, setName] = useState('');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim().length > 0) onSubmit(name.trim().toUpperCase().slice(0, 8));
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col items-center w-full max-w-sm animate-in zoom-in-95 my-4">
             <div className="text-yellow-400 font-bold text-xl md:text-2xl mb-4 animate-pulse font-cyber tracking-widest text-center shadow-[0_0_10px_rgba(255,215,0,0.5)] bg-black/50 px-4 py-1 rounded">
                 NEW HIGH SCORE!
             </div>
             <input 
                autoFocus
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ENTER INITIALS"
                className="w-full bg-black/50 border-2 border-cyan-500/50 focus:border-cyan-400 rounded-lg px-4 py-3 text-white text-center font-mono text-xl tracking-[0.5em] outline-none mb-4 uppercase placeholder:tracking-normal placeholder:text-gray-600"
                maxLength={8}
             />
             <button 
                type="submit"
                disabled={name.trim().length === 0}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-lg transition-all shadow-[0_0_15px_rgba(0,255,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed font-cyber tracking-wider"
             >
                 REGISTER SCORE
             </button>
        </form>
    );
}

const ShopScreen: React.FC = () => {
    const { score, buyItem, closeShop, hasDoubleJump, hasImmortality } = useStore();
    const [items, setItems] = useState<ShopItem[]>([]);

    useEffect(() => {
        // Select 3 random items, filtering out one-time items already bought
        let pool = SHOP_ITEMS.filter(item => {
            if (item.id === 'DOUBLE_JUMP' && hasDoubleJump) return false;
            if (item.id === 'IMMORTAL' && hasImmortality) return false;
            return true;
        });

        // Shuffle and pick 3
        pool = pool.sort(() => 0.5 - Math.random());
        setItems(pool.slice(0, 3));
    }, []);

    return (
        <div className="absolute inset-0 bg-black/90 z-[100] text-white pointer-events-auto backdrop-blur-md overflow-y-auto">
             <div className="flex flex-col items-center justify-center min-h-full py-8 px-4">
                 <h2 className="text-3xl md:text-4xl font-black text-cyan-400 mb-2 font-cyber tracking-widest text-center">CYBER SHOP</h2>
                 <div className="flex items-center text-yellow-400 mb-6 md:mb-8">
                     <span className="text-base md:text-lg mr-2">AVAILABLE CREDITS:</span>
                     <span className="text-xl md:text-2xl font-bold">{score.toLocaleString()}</span>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl w-full mb-8">
                     {items.map(item => {
                         const Icon = item.icon;
                         const canAfford = score >= item.cost;
                         return (
                             <div key={item.id} className="bg-gray-900/80 border border-gray-700 p-4 md:p-6 rounded-xl flex flex-col items-center text-center hover:border-cyan-500 transition-colors">
                                 <div className="bg-gray-800 p-3 md:p-4 rounded-full mb-3 md:mb-4">
                                     <Icon className="w-6 h-6 md:w-8 md:h-8 text-cyan-400" />
                                 </div>
                                 <h3 className="text-lg md:text-xl font-bold mb-2">{item.name}</h3>
                                 <p className="text-gray-400 text-xs md:text-sm mb-4 h-10 md:h-12 flex items-center justify-center">{item.description}</p>
                                 <button 
                                    onClick={() => buyItem(item.id as any, item.cost)}
                                    disabled={!canAfford}
                                    className={`px-4 md:px-6 py-2 rounded font-bold w-full text-sm md:text-base ${canAfford ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110' : 'bg-gray-700 cursor-not-allowed opacity-50'}`}
                                 >
                                     {item.cost} GEMS
                                 </button>
                             </div>
                         );
                     })}
                 </div>

                 <button 
                    onClick={closeShop}
                    className="flex items-center px-8 md:px-10 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg md:text-xl rounded hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,0,255,0.4)]"
                 >
                     RESUME MISSION <Play className="ml-2 w-5 h-5" fill="white" />
                 </button>
             </div>
        </div>
    );
};

export const HUD: React.FC = () => {
  const { 
    score, lives, maxLives, collectedLetters, status, level, restartGame, startGame, 
    gemsCollected, distance, isImmortalityActive, speed, leaderboard, isHighScore, saveScore, 
    baseAccount, authenticateUser, logout, isAuthenticated, userData, fetchLeaderboard, submitGameScore,
    restoreSession, isSessionLoading
  } = useStore();
  const [showMenuLeaderboard, setShowMenuLeaderboard] = useState(false);
  const [hasSubmittedScore, setHasSubmittedScore] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Restore session on mount
  useEffect(() => {
    restoreSession();
  }, []);

  // Fetch leaderboard on mount
  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Generate a fresh nonce for authentication
  const generateNonce = () => {
    return crypto.randomUUID().replace(/-/g, '');
  };

  // Handle Base Account sign-in
  const handleSignIn = async () => {
    try {
      setIsConnecting(true);
      const provider = baseSDK.getProvider();
      const nonce = generateNonce();

      const { accounts } = await provider.request({
        method: 'wallet_connect',
        params: [
          {
            version: '1',
            capabilities: {
              signInWithEthereum: {
                nonce,
                chainId: '0x2105', // Base Mainnet - 8453
              },
            },
          },
        ],
      });

      const { address } = accounts[0];
      const { message, signature } = accounts[0].capabilities?.signInWithEthereum || {};
      
      // Authenticate with backend
      if (message && signature) {
        await authenticateUser(address, message, signature);
      } else {
        // Fallback to quick auth
        await authenticateUser(address);
      }
      
      console.log('Signed in with Base:', address);
    } catch (error) {
      console.error('Sign-in error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle sign out
  const handleSignOut = () => {
    logout();
  };
  
  // Reset submission state when status changes to PLAYING
  useEffect(() => {
      if (status === GameStatus.PLAYING) {
          setHasSubmittedScore(false);
      }
  }, [status]);

  // Auto-submit score when game ends (for authenticated users)
  useEffect(() => {
    if ((status === GameStatus.GAME_OVER || status === GameStatus.VICTORY) && isAuthenticated && !hasSubmittedScore) {
      submitGameScore();
    }
  }, [status, isAuthenticated]);

  const target = ['G', 'E', 'M', 'I', 'N', 'I'];
  const containerClass = "absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-8 z-50";

  if (status === GameStatus.SHOP) {
      return <ShopScreen />;
  }

  if (status === GameStatus.MENU) {
      return (
          <div className="absolute inset-0 flex items-center justify-center z-[100] bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
              
              {/* Session Loading Overlay */}
              {isSessionLoading && (
                <div className="absolute inset-0 bg-black/95 z-[200] flex items-center justify-center">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-cyan-400 font-mono text-sm">LOADING SESSION...</p>
                  </div>
                </div>
              )}

              {/* Leaderboard Overlay */}
              {showMenuLeaderboard && (
                  <div className="absolute inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
                      <div className="relative w-full max-w-md">
                          <button 
                             onClick={() => setShowMenuLeaderboard(false)}
                             className="absolute -top-12 right-0 text-white hover:text-red-500 transition-colors"
                          >
                              <X className="w-8 h-8" />
                          </button>
                          <LeaderboardTable entries={leaderboard} />
                      </div>
                  </div>
              )}

              {/* Card Container */}
              <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,255,255,0.2)] border border-white/10 animate-in zoom-in-95 duration-500">
                
                {/* Image Container - Auto height to fit full image without cropping */}
                <div className="relative w-full bg-gray-900">
                     <img 
                      src="https://www.gstatic.com/aistudio/starter-apps/gemini_runner/gemini_runner.png" 
                      alt="Gemini Runner Cover" 
                      className="w-full h-auto block"
                     />
                     
                     {/* Gradient Overlay for text readability */}
                     <div className="absolute inset-0 bg-gradient-to-t from-[#050011] via-black/30 to-transparent"></div>
                     
                     {/* Content positioned at the bottom of the card */}
                     <div className="absolute inset-0 flex flex-col justify-end items-center p-6 pb-8 text-center z-10">
                        
                        {/* Base Account Sign In/Status */}
                        {isAuthenticated && baseAccount ? (
                          <>
                            <div className="w-full flex items-center justify-between bg-blue-600/20 backdrop-blur-md border border-blue-500/30 rounded-xl px-4 py-3 mb-3">
                              <div className="flex items-center">
                                <Wallet className="w-4 h-4 text-blue-400 mr-2" />
                                <div className="flex flex-col items-start">
                                  <span className="text-blue-300 text-sm font-mono">
                                    {baseAccount.address.slice(0, 6)}...{baseAccount.address.slice(-4)}
                                  </span>
                                  {userData?.username && (
                                    <span className="text-blue-400/70 text-xs">{userData.username}</span>
                                  )}
                                </div>
                              </div>
                              <button 
                                onClick={handleSignOut}
                                className="text-gray-400 hover:text-red-400 transition-colors"
                                title="Sign out"
                              >
                                <LogOut className="w-4 h-4" />
                              </button>
                            </div>

                            <button 
                              onClick={() => { audio.init(); startGame(); }}
                              className="w-full group relative px-6 py-4 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black text-xl rounded-xl hover:bg-white/20 transition-all shadow-[0_0_20px_rgba(0,255,255,0.2)] hover:shadow-[0_0_30px_rgba(0,255,255,0.4)] hover:border-cyan-400 overflow-hidden mb-3"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/40 via-purple-500/40 to-pink-500/40 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                                <span className="relative z-10 tracking-widest flex items-center justify-center">
                                    INITIALIZE RUN <Play className="ml-2 w-5 h-5 fill-white" />
                                </span>
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-4 mb-4">
                              <p className="text-gray-400 text-sm mb-3">Sign in with your Base Account to play</p>
                              <button
                                onClick={handleSignIn}
                                disabled={isConnecting}
                                className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-500 border border-blue-400/30 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Wallet className="w-4 h-4 mr-2" />
                                {isConnecting ? 'CONNECTING...' : 'SIGN IN WITH BASE'}
                              </button>
                            </div>
                          </>
                        )}
                        
                        <button 
                          onClick={() => setShowMenuLeaderboard(true)}
                          className="w-full px-6 py-3 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 text-cyan-300 font-bold text-sm rounded-xl transition-all flex items-center justify-center tracking-widest hover:text-white"
                        >
                            <ListOrdered className="w-4 h-4 mr-2" /> LEADERBOARD
                        </button>

                        <p className="text-cyan-400/60 text-[10px] md:text-xs font-mono mt-3 tracking-wider">
                            [ ARROWS / SWIPE TO MOVE ]
                        </p>
                     </div>
                </div>
              </div>
          </div>
      );
  }

  if (status === GameStatus.GAME_OVER) {
      const qualifiesForHigh = isHighScore(score);
      const showEntry = qualifiesForHigh && !hasSubmittedScore;

      return (
          <div className="absolute inset-0 bg-black/90 z-[100] text-white pointer-events-auto backdrop-blur-sm overflow-y-auto">
              <div className="flex flex-col items-center justify-center min-h-full py-8 px-4">
                <h1 className="text-4xl md:text-6xl font-black text-white mb-6 drop-shadow-[0_0_10px_rgba(255,0,0,0.8)] font-cyber text-center">GAME OVER</h1>
                
                {/* Stats Grid */}
                {!showEntry && (
                    <div className="grid grid-cols-1 gap-3 md:gap-4 text-center mb-8 w-full max-w-md">
                        <div className="bg-gray-900/80 p-3 md:p-4 rounded-lg border border-gray-700 flex items-center justify-between">
                            <div className="flex items-center text-yellow-400 text-sm md:text-base"><Trophy className="mr-2 w-4 h-4 md:w-5 md:h-5"/> LEVEL</div>
                            <div className="text-xl md:text-2xl font-bold font-mono">{level} / 3</div>
                        </div>
                        <div className="bg-gray-900/80 p-3 md:p-4 rounded-lg border border-gray-700 flex items-center justify-between">
                            <div className="flex items-center text-cyan-400 text-sm md:text-base"><Diamond className="mr-2 w-4 h-4 md:w-5 md:h-5"/> GEMS COLLECTED</div>
                            <div className="text-xl md:text-2xl font-bold font-mono">{gemsCollected}</div>
                        </div>
                        <div className="bg-gray-900/80 p-3 md:p-4 rounded-lg border border-gray-700 flex items-center justify-between">
                            <div className="flex items-center text-purple-400 text-sm md:text-base"><MapPin className="mr-2 w-4 h-4 md:w-5 md:h-5"/> DISTANCE</div>
                            <div className="text-xl md:text-2xl font-bold font-mono">{Math.floor(distance)} LY</div>
                        </div>
                        <div className="bg-gray-800/50 p-3 md:p-4 rounded-lg flex items-center justify-between mt-2">
                            <div className="flex items-center text-white text-sm md:text-base">TOTAL SCORE</div>
                            <div className="text-2xl md:text-3xl font-bold font-cyber text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">{score.toLocaleString()}</div>
                        </div>
                    </div>
                )}

                {/* High Score Entry */}
                {showEntry && (
                    <div className="mb-8 w-full flex justify-center">
                        <HighScoreForm onSubmit={(name) => {
                            saveScore(name);
                            setHasSubmittedScore(true);
                        }} />
                    </div>
                )}

                {/* Leaderboard Display (Only if not entering score) */}
                {!showEntry && (
                    <div className="w-full flex justify-center mb-8">
                         <LeaderboardTable entries={leaderboard} />
                    </div>
                )}

                {/* Restart Button */}
                {!showEntry && (
                    <button 
                    onClick={() => { audio.init(); restartGame(); }}
                    className="px-8 md:px-10 py-3 md:py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg md:text-xl rounded hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,255,0.4)]"
                    >
                        RUN AGAIN
                    </button>
                )}
              </div>
          </div>
      );
  }

  if (status === GameStatus.VICTORY) {
    const qualifiesForHigh = isHighScore(score);
    const showEntry = qualifiesForHigh && !hasSubmittedScore;

    return (
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/90 to-black/95 z-[100] text-white pointer-events-auto backdrop-blur-md overflow-y-auto">
            <div className="flex flex-col items-center justify-center min-h-full py-8 px-4">
                <Rocket className="w-16 h-16 md:w-24 md:h-24 text-yellow-400 mb-4 animate-bounce drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]" />
                <h1 className="text-3xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-500 to-pink-500 mb-2 drop-shadow-[0_0_20px_rgba(255,165,0,0.6)] font-cyber text-center leading-tight">
                    MISSION COMPLETE
                </h1>
                <p className="text-cyan-300 text-sm md:text-2xl font-mono mb-8 tracking-widest text-center">
                    THE ANSWER TO THE UNIVERSE HAS BEEN FOUND
                </p>
                
                {!showEntry && (
                    <div className="grid grid-cols-1 gap-4 text-center mb-8 w-full max-w-md">
                        <div className="bg-black/60 p-6 rounded-xl border border-yellow-500/30 shadow-[0_0_15px_rgba(255,215,0,0.1)]">
                            <div className="text-xs md:text-sm text-gray-400 mb-1 tracking-wider">FINAL SCORE</div>
                            <div className="text-3xl md:text-4xl font-bold font-cyber text-yellow-400">{score.toLocaleString()}</div>
                        </div>
                         {/* Mini Stats */}
                         <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/60 p-4 rounded-lg border border-white/10">
                                <div className="text-xs text-gray-400">GEMS</div>
                                <div className="text-xl md:text-2xl font-bold text-cyan-400">{gemsCollected}</div>
                            </div>
                            <div className="bg-black/60 p-4 rounded-lg border border-white/10">
                                 <div className="text-xs text-gray-400">DISTANCE</div>
                                <div className="text-xl md:text-2xl font-bold text-purple-400">{Math.floor(distance)} LY</div>
                            </div>
                         </div>
                    </div>
                )}

                {/* High Score Entry */}
                {showEntry && (
                    <div className="mb-8 w-full flex justify-center">
                        <HighScoreForm onSubmit={(name) => {
                            saveScore(name);
                            setHasSubmittedScore(true);
                        }} />
                    </div>
                )}

                 {/* Leaderboard Display (Only if not entering score) */}
                {!showEntry && (
                    <div className="w-full flex justify-center mb-8">
                         <LeaderboardTable entries={leaderboard} />
                    </div>
                )}

                {!showEntry && (
                    <button 
                    onClick={() => { audio.init(); restartGame(); }}
                    className="px-8 md:px-12 py-4 md:py-5 bg-white text-black font-black text-lg md:text-xl rounded hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] tracking-widest"
                    >
                        RESTART MISSION
                    </button>
                )}
            </div>
        </div>
    );
  }

  return (
    <div className={containerClass}>
        {/* Active Powerups */}
        <ActivePowerups />

        {/* Top Bar */}
        <div className="flex justify-between items-start w-full">
            <div className="flex flex-col">
                <div className="text-3xl md:text-5xl font-bold text-cyan-400 drop-shadow-[0_0_10px_#00ffff] font-cyber">
                    {score.toLocaleString()}
                </div>
            </div>
            
            <div className="flex space-x-1 md:space-x-2">
                {[...Array(maxLives)].map((_, i) => (
                    <Heart 
                        key={i} 
                        className={`w-6 h-6 md:w-8 md:h-8 ${i < lives ? 'text-pink-500 fill-pink-500' : 'text-gray-800 fill-gray-800'} drop-shadow-[0_0_5px_#ff0054]`} 
                    />
                ))}
            </div>
        </div>
        
        {/* Level Indicator - Moved to Top Center aligned with Score/Hearts */}
        <div className="absolute top-5 left-1/2 transform -translate-x-1/2 text-sm md:text-lg text-purple-300 font-bold tracking-wider font-mono bg-black/50 px-3 py-1 rounded-full border border-purple-500/30 backdrop-blur-sm z-50">
            LEVEL {level} <span className="text-gray-500 text-xs md:text-sm">/ 3</span>
        </div>

        {/* Active Skill Indicator (Immortality) */}
        {isImmortalityActive && (
             <div className="absolute top-36 left-4 text-yellow-400 font-bold text-lg md:text-xl animate-pulse flex items-center drop-shadow-[0_0_10px_gold]">
                 <Shield className="mr-2 fill-yellow-400 w-5 h-5" /> IMMORTAL
             </div>
        )}

        {/* Gemini Collection Status - Just below Top Bar */}
        <div className="absolute top-16 md:top-24 left-1/2 transform -translate-x-1/2 flex space-x-2 md:space-x-3">
            {target.map((char, idx) => {
                const isCollected = collectedLetters.includes(idx);
                const color = GEMINI_COLORS[idx];

                return (
                    <div 
                        key={idx}
                        style={{
                            borderColor: isCollected ? color : 'rgba(55, 65, 81, 1)',
                            // Use dark text (almost black) when collected to contrast with neon background
                            color: isCollected ? 'rgba(0, 0, 0, 0.8)' : 'rgba(55, 65, 81, 1)',
                            boxShadow: isCollected ? `0 0 20px ${color}` : 'none',
                            backgroundColor: isCollected ? color : 'rgba(0, 0, 0, 0.9)'
                        }}
                        className={`w-8 h-10 md:w-10 md:h-12 flex items-center justify-center border-2 font-black text-lg md:text-xl font-cyber rounded-lg transform transition-all duration-300`}
                    >
                        {char}
                    </div>
                );
            })}
        </div>

        {/* Bottom Overlay */}
        <div className="w-full flex justify-end items-end">
             <div className="flex items-center space-x-2 text-cyan-500 opacity-70">
                 <Zap className="w-4 h-4 md:w-6 md:h-6 animate-pulse" />
                 <span className="font-mono text-base md:text-xl">SPEED {Math.round((speed / RUN_SPEED_BASE) * 100)}%</span>
             </div>
        </div>
    </div>
  );
};
