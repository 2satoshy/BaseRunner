
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text3D, Center, Float } from '@react-three/drei';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../store';
import { GameObject, ObjectType, LANE_WIDTH, SPAWN_DISTANCE, REMOVE_DISTANCE, GameStatus, GEMINI_COLORS } from '../../types';
import { audio } from '../System/Audio';

// Geometry Constants
const OBSTACLE_HEIGHT = 1.6;
const OBSTACLE_GEOMETRY = new THREE.ConeGeometry(0.9, OBSTACLE_HEIGHT, 6);
const OBSTACLE_GLOW_GEO = new THREE.ConeGeometry(0.9, OBSTACLE_HEIGHT, 6);
const OBSTACLE_RING_GEO = new THREE.RingGeometry(0.6, 0.9, 6);

const GEM_GEOMETRY = new THREE.IcosahedronGeometry(0.3, 0);

// Alien Geometries
const ALIEN_BODY_GEO = new THREE.CylinderGeometry(0.6, 0.3, 0.3, 8);
const ALIEN_DOME_GEO = new THREE.SphereGeometry(0.4, 16, 16, 0, Math.PI * 2, 0, Math.PI/2);
const ALIEN_EYE_GEO = new THREE.SphereGeometry(0.1);

// Drone Geometries
const DRONE_BODY_GEO = new THREE.SphereGeometry(0.5, 16, 16);
const DRONE_ENGINE_GEO = new THREE.CylinderGeometry(0.1, 0.2, 0.6);
const DRONE_EYE_GEO = new THREE.SphereGeometry(0.2);

// Powerup Geometries
const MAGNET_GEO = new THREE.TorusGeometry(0.4, 0.1, 8, 16, Math.PI * 1.5);
const SHIELD_GEO = new THREE.IcosahedronGeometry(0.5, 1);

// Missile Geometries
const MISSILE_CORE_GEO = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 8);
const MISSILE_RING_GEO = new THREE.TorusGeometry(0.15, 0.02, 16, 32);

// Shadow Geometries
const SHADOW_LETTER_GEO = new THREE.PlaneGeometry(2, 0.6);
const SHADOW_GEM_GEO = new THREE.CircleGeometry(0.6, 32);
const SHADOW_ALIEN_GEO = new THREE.CircleGeometry(0.8, 32);
const SHADOW_MISSILE_GEO = new THREE.PlaneGeometry(0.15, 3);
const SHADOW_DEFAULT_GEO = new THREE.CircleGeometry(0.8, 6);

// New Obstacle Geometries
const LASER_POST_GEO = new THREE.CylinderGeometry(0.15, 0.15, 3, 8);
const LASER_BEAM_GEO = new THREE.BoxGeometry(1, 0.3, 0.1); // Will be scaled
const BARRIER_GEO = new THREE.BoxGeometry(0.5, 2.5, 0.5);
const SPIKE_GEO = new THREE.ConeGeometry(0.3, 0.8, 4);
const TURRET_BASE_GEO = new THREE.CylinderGeometry(0.5, 0.6, 0.4, 8);
const TURRET_BARREL_GEO = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
const JUMP_PAD_GEO = new THREE.CylinderGeometry(0.8, 0.8, 0.15, 16);
const SPEED_BOOST_GEO = new THREE.ConeGeometry(0.4, 0.8, 6);

// Shop Geometries
const SHOP_FRAME_GEO = new THREE.BoxGeometry(1, 7, 1); // Will be scaled
const SHOP_BACK_GEO = new THREE.BoxGeometry(1, 5, 1.2); // Will be scaled
const SHOP_OUTLINE_GEO = new THREE.BoxGeometry(1, 7.2, 0.8); // Will be scaled
const SHOP_FLOOR_GEO = new THREE.PlaneGeometry(1, 4); // Will be scaled

const PARTICLE_COUNT = 600;
const BASE_LETTER_INTERVAL = 200; // Increased slightly for longer levels

const getLetterInterval = (level: number) => {
    // Level 1: 200, Level 2: 280, Level 3: 360...
    // Slower increase for longer gameplay
    return BASE_LETTER_INTERVAL * (1 + (level - 1) * 0.4);
};

// Difficulty scaling per level
const getDifficultyConfig = (level: number) => ({
    // Obstacle spawn chance increases per level
    obstacleChance: Math.min(0.20 + (level * 0.05), 0.50), // 20% to 50%
    // Multi-obstacle chance
    multiObstacleChance: Math.min(0.50 + (level * 0.05), 0.85),
    tripleObstacleChance: Math.min(0.80 + (level * 0.02), 0.95),
    // Enemy spawn chances
    droneChance: level >= 2 ? Math.min(0.10 + (level - 2) * 0.03, 0.25) : 0,
    alienChance: level >= 2 ? Math.min(0.15 + (level - 2) * 0.04, 0.35) : 0,
    // Gap/platform mechanics (level 4+)
    gapChance: level >= 4 ? Math.min(0.05 + (level - 4) * 0.02, 0.15) : 0,
    // Gem values increase per level
    gemBaseValue: 50 + (level - 1) * 10,
    gemBonusValue: 100 + (level - 1) * 25,
    // Minimum gap between spawns (decreases with level for more density)
    minGap: Math.max(10, 14 - level * 0.5),
    // Powerup frequency (slightly more at higher levels to help)
    powerupChance: Math.min(0.05 + (level * 0.01), 0.12),
});

const MISSILE_SPEED = 30; // Extra speed added to world speed

// Font for 3D Text
const FONT_URL = "https://cdn.jsdelivr.net/npm/three/examples/fonts/helvetiker_bold.typeface.json";

// --- Particle System ---
const ParticleSystem: React.FC = () => {
    const mesh = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    const particles = useMemo(() => new Array(PARTICLE_COUNT).fill(0).map(() => ({
        life: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        color: new THREE.Color()
    })), []);

    useEffect(() => {
        const handleExplosion = (e: CustomEvent) => {
            const { position, color } = e.detail;
            let spawned = 0;
            const burstAmount = 40; 

            for(let i = 0; i < PARTICLE_COUNT; i++) {
                const p = particles[i];
                if (p.life <= 0) {
                    p.life = 1.0 + Math.random() * 0.5; 
                    p.pos.set(position[0], position[1], position[2]);
                    
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    const speed = 2 + Math.random() * 10;
                    
                    p.vel.set(
                        Math.sin(phi) * Math.cos(theta),
                        Math.sin(phi) * Math.sin(theta),
                        Math.cos(phi)
                    ).multiplyScalar(speed);

                    p.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                    p.rotVel.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(5);
                    
                    p.color.set(color);
                    
                    spawned++;
                    if (spawned >= burstAmount) break;
                }
            }
        };
        
        window.addEventListener('particle-burst', handleExplosion as any);
        return () => window.removeEventListener('particle-burst', handleExplosion as any);
    }, [particles]);

    useFrame((state, delta) => {
        if (!mesh.current) return;
        const safeDelta = Math.min(delta, 0.1);

        particles.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= safeDelta * 1.5;
                p.pos.addScaledVector(p.vel, safeDelta);
                p.vel.y -= safeDelta * 5; 
                p.vel.multiplyScalar(0.98);

                p.rot.x += p.rotVel.x * safeDelta;
                p.rot.y += p.rotVel.y * safeDelta;
                
                dummy.position.copy(p.pos);
                const scale = Math.max(0, p.life * 0.25);
                dummy.scale.set(scale, scale, scale);
                
                dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
                dummy.updateMatrix();
                
                mesh.current!.setMatrixAt(i, dummy.matrix);
                mesh.current!.setColorAt(i, p.color);
            } else {
                dummy.scale.set(0,0,0);
                dummy.updateMatrix();
                mesh.current!.setMatrixAt(i, dummy.matrix);
            }
        });
        
        mesh.current.instanceMatrix.needsUpdate = true;
        if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, PARTICLE_COUNT]}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
        </instancedMesh>
    );
};


const getRandomLane = (laneCount: number) => {
    const max = Math.floor(laneCount / 2);
    return Math.floor(Math.random() * (max * 2 + 1)) - max;
};

export const LevelManager: React.FC = () => {
  const { 
    status, 
    speed, 
    collectGem, 
    collectLetter, 
    collectedLetters,
    laneCount,
    setDistance,
    openShop,
    level,
    magnetEndTime,
    activateMagnet,
    activateShield
  } = useStore();
  
  const objectsRef = useRef<GameObject[]>([]);
  const [renderTrigger, setRenderTrigger] = useState(0);
  const prevStatus = useRef(status);
  const prevLevel = useRef(level);

  const playerObjRef = useRef<THREE.Object3D | null>(null);
  const distanceTraveled = useRef(0);
  const nextLetterDistance = useRef(BASE_LETTER_INTERVAL);

  // Handle resets and transitions
  useEffect(() => {
    const isRestart = status === GameStatus.PLAYING && prevStatus.current === GameStatus.GAME_OVER;
    const isMenuReset = status === GameStatus.MENU;
    const isLevelUp = level !== prevLevel.current && status === GameStatus.PLAYING;
    const isVictoryReset = status === GameStatus.PLAYING && prevStatus.current === GameStatus.VICTORY;

    if (isMenuReset || isRestart || isVictoryReset) {
        // Hard Reset of objects
        objectsRef.current = [];
        setRenderTrigger(t => t + 1);
        
        // Reset trackers
        distanceTraveled.current = 0;
        nextLetterDistance.current = getLetterInterval(1);

    } else if (isLevelUp && level > 1) {
        // Soft Reset for Level Up (Keep visible objects)
        objectsRef.current = objectsRef.current.filter(obj => obj.position[2] > -80);

        // Spawn Shop Portal further out
        objectsRef.current.push({
            id: uuidv4(),
            type: ObjectType.SHOP_PORTAL,
            position: [0, 0, -100], 
            active: true,
        });
        
        nextLetterDistance.current = distanceTraveled.current - SPAWN_DISTANCE + getLetterInterval(level);
        setRenderTrigger(t => t + 1);
        
    } else if (status === GameStatus.GAME_OVER || status === GameStatus.VICTORY) {
        setDistance(Math.floor(distanceTraveled.current));
    }
    
    prevStatus.current = status;
    prevLevel.current = level;
  }, [status, level, setDistance]);

  useFrame((state) => {
      if (!playerObjRef.current) {
          const group = state.scene.getObjectByName('PlayerGroup');
          if (group && group.children.length > 0) {
              playerObjRef.current = group.children[0];
          }
      }
  });

  useFrame((state, delta) => {
    if (status !== GameStatus.PLAYING) return;

    const safeDelta = Math.min(delta, 0.05); 
    const dist = speed * safeDelta;
    
    distanceTraveled.current += dist;

    let hasChanges = false;
    let playerPos = new THREE.Vector3(0, 0, 0);
    
    if (playerObjRef.current) {
        playerObjRef.current.getWorldPosition(playerPos);
    }

    const isMagnetActive = Date.now() < magnetEndTime;

    // 1. Move & Update
    const currentObjects = objectsRef.current;
    const keptObjects: GameObject[] = [];
    const newSpawns: GameObject[] = [];

    for (const obj of currentObjects) {
        // Standard Movement
        let moveAmount = dist;
        
        // Missile Movement (Moves faster than world)
        if (obj.type === ObjectType.MISSILE) {
            moveAmount += MISSILE_SPEED * safeDelta;
        }

        const prevZ = obj.position[2];
        obj.position[2] += moveAmount;

        // MAGNET LOGIC
        if (isMagnetActive && obj.type === ObjectType.GEM && obj.active) {
            const dx = playerPos.x - obj.position[0];
            const dz = playerPos.z - obj.position[2];
            const distToPlayer = Math.sqrt(dx * dx + dz * dz);
            
            // If nearby, fly to player
            if (distToPlayer < 40) {
                // Lerp factor increases as it gets closer
                const pullStrength = safeDelta * 10;
                obj.position[0] += dx * pullStrength;
                obj.position[2] += dz * pullStrength;
                // Lift off ground slightly
                obj.position[1] = THREE.MathUtils.lerp(obj.position[1], playerPos.y, pullStrength);
            }
        }

        // DRONE AI LOGIC
        if (obj.type === ObjectType.DRONE && obj.active) {
            // Drone attempts to match player X slowly to block them
            // Only if drone is in front of player
            if (obj.position[2] < playerPos.z - 5) {
                const targetX = playerPos.x;
                const lerpSpeed = safeDelta * 1.5; // Slow tracking
                obj.position[0] = THREE.MathUtils.lerp(obj.position[0], targetX, lerpSpeed);
            }
        }

        // BARRIER MOVEMENT LOGIC (side-to-side)
        if (obj.type === ObjectType.BARRIER && obj.active) {
            const maxX = Math.floor(laneCount / 2) * LANE_WIDTH;
            obj.position[0] += (obj.moveDirection || 1) * (obj.moveSpeed || 3) * safeDelta;
            
            // Bounce off lane boundaries
            if (obj.position[0] > maxX) {
                obj.position[0] = maxX;
                obj.moveDirection = -1;
            } else if (obj.position[0] < -maxX) {
                obj.position[0] = -maxX;
                obj.moveDirection = 1;
            }
        }

        // TURRET FIRING LOGIC
        if (obj.type === ObjectType.TURRET && obj.active && !obj.hasFired) {
            if (obj.position[2] > -80) {
                obj.hasFired = true;
                
                // Fire at player's current lane
                newSpawns.push({
                    id: uuidv4(),
                    type: ObjectType.MISSILE,
                    position: [obj.position[0], 0.8, obj.position[2] + 2],
                    active: true,
                    color: '#ffaa00'
                });
                hasChanges = true;
                
                window.dispatchEvent(new CustomEvent('particle-burst', {
                    detail: { position: obj.position, color: '#ffaa00' }
                }));
            }
        }
        
        // ALIEN AI LOGIC
        if (obj.type === ObjectType.ALIEN && obj.active && !obj.hasFired) {
             if (obj.position[2] > -90) {
                 obj.hasFired = true;
                 
                 newSpawns.push({
                     id: uuidv4(),
                     type: ObjectType.MISSILE,
                     position: [obj.position[0], 1.0, obj.position[2] + 2], 
                     active: true,
                     color: '#ff0000'
                 });
                 hasChanges = true;
                 
                 window.dispatchEvent(new CustomEvent('particle-burst', { 
                    detail: { position: obj.position, color: '#ff00ff' } 
                 }));
             }
        }

        let keep = true;
        if (obj.active) {
            // Collision Detection
            const zThreshold = 2.0; 
            const inZZone = (prevZ < playerPos.z + zThreshold) && (obj.position[2] > playerPos.z - zThreshold);
            
            // SHOP PORTAL COLLISION
            if (obj.type === ObjectType.SHOP_PORTAL) {
                const dz = Math.abs(obj.position[2] - playerPos.z);
                if (dz < 2) { 
                     openShop();
                     obj.active = false;
                     hasChanges = true;
                     keep = false; 
                }
            } else if (inZZone) {
                // STANDARD COLLISION
                const dx = Math.abs(obj.position[0] - playerPos.x);
                // Increased forgiveness for pickup types
                const hitDist = (obj.type === ObjectType.MAGNET || obj.type === ObjectType.SHIELD) ? 1.5 : 0.9;

                if (dx < hitDist) { 
                     
                     const isDamageSource = obj.type === ObjectType.OBSTACLE 
                        || obj.type === ObjectType.ALIEN 
                        || obj.type === ObjectType.MISSILE
                        || obj.type === ObjectType.DRONE
                        || obj.type === ObjectType.LASER_GATE
                        || obj.type === ObjectType.BARRIER
                        || obj.type === ObjectType.SPIKE_FLOOR
                        || obj.type === ObjectType.TURRET;
                     
                     if (isDamageSource) {
                         const playerBottom = playerPos.y;
                         const playerTop = playerPos.y + 1.8; 

                         let objBottom = obj.position[1] - 0.5;
                         let objTop = obj.position[1] + 0.5;

                         if (obj.type === ObjectType.OBSTACLE) {
                             objBottom = 0;
                             objTop = OBSTACLE_HEIGHT;
                         } else if (obj.type === ObjectType.MISSILE) {
                             objBottom = 0.5;
                             objTop = 1.5;
                         } else if (obj.type === ObjectType.DRONE) {
                             objBottom = obj.position[1] - 0.5;
                             objTop = obj.position[1] + 0.5;
                         } else if (obj.type === ObjectType.LASER_GATE) {
                             objBottom = 0.5;
                             objTop = 1.2; // Jump over laser
                         } else if (obj.type === ObjectType.BARRIER) {
                             objBottom = 0;
                             objTop = 2.5;
                         } else if (obj.type === ObjectType.SPIKE_FLOOR) {
                             objBottom = 0;
                             objTop = 0.8; // Low to ground, can jump over
                         } else if (obj.type === ObjectType.TURRET) {
                             objBottom = 0;
                             objTop = 0.8; // Can jump over turret
                         }

                         const isHit = (playerBottom < objTop) && (playerTop > objBottom);

                         if (isHit) { 
                             window.dispatchEvent(new Event('player-hit'));
                             obj.active = false; 
                             hasChanges = true;
                             
                             const burstColor = obj.type === ObjectType.DRONE ? '#000000' : '#ff4400';
                             window.dispatchEvent(new CustomEvent('particle-burst', { 
                                detail: { position: obj.position, color: burstColor } 
                             }));
                         }
                     } else {
                         // Item Collection
                         const dy = Math.abs(obj.position[1] - playerPos.y);
                         if (dy < 2.5) { 
                            if (obj.type === ObjectType.GEM) {
                                collectGem(obj.points || 50);
                                audio.playGemCollect();
                            } else if (obj.type === ObjectType.LETTER && obj.targetIndex !== undefined) {
                                collectLetter(obj.targetIndex);
                                audio.playLetterCollect();
                            } else if (obj.type === ObjectType.MAGNET) {
                                activateMagnet();
                                audio.playGemCollect(); // Reuse positive sound
                            } else if (obj.type === ObjectType.SHIELD) {
                                activateShield();
                                audio.playGemCollect();
                            }
                            
                            window.dispatchEvent(new CustomEvent('particle-burst', { 
                                detail: { 
                                    position: obj.position, 
                                    color: obj.color || '#ffffff' 
                                } 
                            }));

                            obj.active = false;
                            hasChanges = true;
                         }
                     }
                }
            }
        }

        if (obj.position[2] > REMOVE_DISTANCE) {
            keep = false;
            hasChanges = true;
        }

        if (keep) {
            keptObjects.push(obj);
        }
    }

    if (newSpawns.length > 0) {
        keptObjects.push(...newSpawns);
    }

    // 2. Spawning Logic
    let furthestZ = 0;
    const staticObjects = keptObjects.filter(o => o.type !== ObjectType.MISSILE && o.type !== ObjectType.DRONE);
    
    if (staticObjects.length > 0) {
        furthestZ = Math.min(...staticObjects.map(o => o.position[2]));
    } else {
        furthestZ = -20;
    }

    if (furthestZ > -SPAWN_DISTANCE) {
         const config = getDifficultyConfig(level);
         const minGap = config.minGap + (speed * 0.3); 
         const spawnZ = Math.min(furthestZ - minGap, -SPAWN_DISTANCE);
         
         const isLetterDue = distanceTraveled.current >= nextLetterDistance.current;

         if (isLetterDue) {
             const lane = getRandomLane(laneCount);
             const target = ['G','E','M','I','N','I'];
             const availableIndices = target.map((_, i) => i).filter(i => !collectedLetters.includes(i));

             if (availableIndices.length > 0) {
                 const chosenIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                 const val = target[chosenIndex];
                 const color = GEMINI_COLORS[chosenIndex];

                 keptObjects.push({
                    id: uuidv4(),
                    type: ObjectType.LETTER,
                    position: [lane * LANE_WIDTH, 1.0, spawnZ], 
                    active: true,
                    color: color,
                    value: val,
                    targetIndex: chosenIndex
                 });
                 
                 nextLetterDistance.current += getLetterInterval(level);
                 hasChanges = true;
             } else {
                keptObjects.push({
                    id: uuidv4(),
                    type: ObjectType.GEM,
                    position: [lane * LANE_WIDTH, 1.2, spawnZ],
                    active: true,
                    color: '#00ffff',
                    points: config.gemBaseValue
                });
                hasChanges = true;
             }

         } else if (Math.random() > 0.1) {
            const isObstacle = Math.random() < config.obstacleChance;

            if (isObstacle) {
                // Determine obstacle type based on level
                const obstacleRoll = Math.random();
                
                // Level 4+: Laser Gates (10% chance)
                if (level >= 4 && obstacleRoll < 0.10) {
                    // Laser gate spans multiple lanes
                    const gateWidth = Math.min(2 + Math.floor(level / 3), laneCount);
                    keptObjects.push({
                        id: uuidv4(),
                        type: ObjectType.LASER_GATE,
                        position: [0, 0.8, spawnZ],
                        active: true,
                        color: '#ff0000',
                        laserActive: true,
                        value: String(gateWidth) // Store gate width
                    });
                }
                // Level 5+: Moving Barriers (8% chance)
                else if (level >= 5 && obstacleRoll < 0.18) {
                    const lane = getRandomLane(laneCount);
                    keptObjects.push({
                        id: uuidv4(),
                        type: ObjectType.BARRIER,
                        position: [lane * LANE_WIDTH, 1.25, spawnZ],
                        active: true,
                        color: '#ff6600',
                        moveDirection: Math.random() > 0.5 ? 1 : -1,
                        moveSpeed: 3 + level * 0.5
                    });
                }
                // Level 3+: Spike Floors (12% chance)
                else if (level >= 3 && obstacleRoll < 0.30) {
                    const availableLanes = [];
                    const maxLane = Math.floor(laneCount / 2);
                    for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
                    availableLanes.sort(() => Math.random() - 0.5);
                    
                    const spikeCount = Math.min(1 + Math.floor(Math.random() * 3), availableLanes.length);
                    for (let i = 0; i < spikeCount; i++) {
                        const lane = availableLanes[i];
                        keptObjects.push({
                            id: uuidv4(),
                            type: ObjectType.SPIKE_FLOOR,
                            position: [lane * LANE_WIDTH, 0, spawnZ],
                            active: true,
                            color: '#cc0000'
                        });
                    }
                }
                // Level 6+: Turrets (8% chance)
                else if (level >= 6 && obstacleRoll < 0.38) {
                    const lane = getRandomLane(laneCount);
                    keptObjects.push({
                        id: uuidv4(),
                        type: ObjectType.TURRET,
                        position: [lane * LANE_WIDTH, 0.2, spawnZ],
                        active: true,
                        color: '#666666',
                        hasFired: false
                    });
                }
                // Drones (level 2+)
                else if (Math.random() < config.droneChance) {
                    const lane = getRandomLane(laneCount);
                    keptObjects.push({
                        id: uuidv4(),
                        type: ObjectType.DRONE,
                        position: [lane * LANE_WIDTH, 1.5, spawnZ],
                        active: true,
                        color: '#111111'
                    });
                }
                // Aliens (level 2+)
                else if (Math.random() < config.alienChance) {
                    const availableLanes = [];
                    const maxLane = Math.floor(laneCount / 2);
                    for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
                    availableLanes.sort(() => Math.random() - 0.5);

                    let alienCount = 1;
                    const pAlien = Math.random();
                    if (pAlien > 0.7) alienCount = Math.min(2, availableLanes.length);
                    if (pAlien > 0.9 && availableLanes.length >= 3) alienCount = 3;

                    for (let k = 0; k < alienCount; k++) {
                        const lane = availableLanes[k];
                        keptObjects.push({
                            id: uuidv4(),
                            type: ObjectType.ALIEN,
                            position: [lane * LANE_WIDTH, 1.5, spawnZ],
                            active: true,
                            color: '#00ff00',
                            hasFired: false
                        });
                    }
                } else {
                    // Standard Obstacles
                    const availableLanes = [];
                    const maxLane = Math.floor(laneCount / 2);
                    for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
                    availableLanes.sort(() => Math.random() - 0.5);
                    
                    let countToSpawn = 1;
                    const p = Math.random();

                    if (p > config.tripleObstacleChance) countToSpawn = Math.min(3, availableLanes.length);
                    else if (p > config.multiObstacleChance) countToSpawn = Math.min(2, availableLanes.length);

                    for (let i = 0; i < countToSpawn; i++) {
                        const lane = availableLanes[i];
                        const laneX = lane * LANE_WIDTH;
                        
                        keptObjects.push({
                            id: uuidv4(),
                            type: ObjectType.OBSTACLE,
                            position: [laneX, OBSTACLE_HEIGHT / 2, spawnZ],
                            active: true,
                            color: '#ff0054'
                        });

                        // Chance for Powerup or Gem on top of obstacle
                        const topRoll = Math.random();
                        if (topRoll < config.powerupChance) {
                             // Powerup Spawn
                             const isShield = Math.random() > 0.5;
                             keptObjects.push({
                                id: uuidv4(),
                                type: isShield ? ObjectType.SHIELD : ObjectType.MAGNET,
                                position: [laneX, OBSTACLE_HEIGHT + 1.0, spawnZ],
                                active: true,
                                color: isShield ? '#00ffff' : '#d000ff'
                             });
                        } else if (topRoll < 0.3) {
                             keptObjects.push({
                                id: uuidv4(),
                                type: ObjectType.GEM,
                                position: [laneX, OBSTACLE_HEIGHT + 1.0, spawnZ],
                                active: true,
                                color: '#ffd700',
                                points: config.gemBonusValue
                            });
                        }
                    }
                }

            } else {
                // Ground Items
                const lane = getRandomLane(laneCount);
                
                // Level 4+: Jump Pads (3% chance)
                if (level >= 4 && Math.random() < 0.03) {
                    keptObjects.push({
                       id: uuidv4(),
                       type: ObjectType.JUMP_PAD,
                       position: [lane * LANE_WIDTH, 0.1, spawnZ],
                       active: true,
                       color: '#00ff88'
                    });
                }
                // Level 7+: Speed Boosts (3% chance)
                else if (level >= 7 && Math.random() < 0.03) {
                    keptObjects.push({
                       id: uuidv4(),
                       type: ObjectType.SPEED_BOOST,
                       position: [lane * LANE_WIDTH, 0.5, spawnZ],
                       active: true,
                       color: '#ffaa00'
                    });
                }
                // Powerup chance
                else if (Math.random() < config.powerupChance) {
                    const isShield = Math.random() > 0.5;
                    keptObjects.push({
                       id: uuidv4(),
                       type: isShield ? ObjectType.SHIELD : ObjectType.MAGNET,
                       position: [lane * LANE_WIDTH, 1.2, spawnZ],
                       active: true,
                       color: isShield ? '#00ffff' : '#d000ff'
                    });
                } else {
                    // Standard gem with level-scaled value
                    keptObjects.push({
                        id: uuidv4(),
                        type: ObjectType.GEM,
                        position: [lane * LANE_WIDTH, 1.2, spawnZ],
                        active: true,
                        color: '#00ffff',
                        points: config.gemBaseValue
                    });
                }
            }
            hasChanges = true;
         }
    }

    if (hasChanges) {
        objectsRef.current = keptObjects;
        setRenderTrigger(t => t + 1);
    }
  });

  return (
    <group>
      <ParticleSystem />
      {objectsRef.current.map(obj => {
        if (!obj.active) return null;
        return <GameEntity key={obj.id} data={obj} />;
      })}
    </group>
  );
};

const GameEntity: React.FC<{ data: GameObject }> = React.memo(({ data }) => {
    const groupRef = useRef<THREE.Group>(null);
    const visualRef = useRef<THREE.Group>(null);
    const shadowRef = useRef<THREE.Mesh>(null);
    const { laneCount } = useStore();
    
    useFrame((state, delta) => {
        if (groupRef.current) {
            groupRef.current.position.set(data.position[0], 0, data.position[2]);
        }

        if (visualRef.current) {
            const baseHeight = data.position[1];
            
            if (data.type === ObjectType.SHOP_PORTAL) {
                 visualRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.02);
            } else if (data.type === ObjectType.MISSILE) {
                 visualRef.current.rotation.z += delta * 20; 
                 visualRef.current.position.y = baseHeight;
            } else if (data.type === ObjectType.ALIEN) {
                 visualRef.current.position.y = baseHeight + Math.sin(state.clock.elapsedTime * 3) * 0.2;
                 visualRef.current.rotation.y += delta;
            } else if (data.type === ObjectType.DRONE) {
                 // Drone tilt based on movement?
                 visualRef.current.position.y = baseHeight + Math.sin(state.clock.elapsedTime * 5) * 0.1;
                 // Rocking motion
                 visualRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.1;
            } else if (data.type !== ObjectType.OBSTACLE) {
                // Items (Gem, Letter, Magnet, Shield)
                visualRef.current.rotation.y += delta * 3;
                const bobOffset = Math.sin(state.clock.elapsedTime * 4 + data.position[0]) * 0.1;
                visualRef.current.position.y = baseHeight + bobOffset;
                
                if (shadowRef.current) {
                    const shadowScale = 1 - bobOffset; 
                    shadowRef.current.scale.setScalar(shadowScale);
                }
            } else {
                visualRef.current.position.y = baseHeight;
            }
        }
    });

    const shadowGeo = useMemo(() => {
        if (data.type === ObjectType.LETTER) return SHADOW_LETTER_GEO;
        if (data.type === ObjectType.GEM) return SHADOW_GEM_GEO;
        if (data.type === ObjectType.SHOP_PORTAL) return null;
        if (data.type === ObjectType.ALIEN) return SHADOW_ALIEN_GEO;
        if (data.type === ObjectType.MISSILE) return SHADOW_MISSILE_GEO;
        return SHADOW_DEFAULT_GEO; 
    }, [data.type]);

    return (
        <group ref={groupRef} position={[data.position[0], 0, data.position[2]]}>
            {data.type !== ObjectType.SHOP_PORTAL && shadowGeo && (
                <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} geometry={shadowGeo}>
                    <meshBasicMaterial color="#000000" opacity={0.3} transparent />
                </mesh>
            )}

            <group ref={visualRef} position={[0, data.position[1], 0]}>
                {/* --- SHOP PORTAL --- */}
                {data.type === ObjectType.SHOP_PORTAL && (
                    <group>
                         <mesh position={[0, 3, 0]} geometry={SHOP_FRAME_GEO} scale={[laneCount * LANE_WIDTH + 2, 1, 1]}>
                             <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} />
                         </mesh>
                         <mesh position={[0, 2, 0]} geometry={SHOP_BACK_GEO} scale={[laneCount * LANE_WIDTH, 1, 1]}>
                              <meshBasicMaterial color="#000000" />
                         </mesh>
                         <mesh position={[0, 3, 0]} geometry={SHOP_OUTLINE_GEO} scale={[laneCount * LANE_WIDTH + 2.2, 1, 1]}>
                             <meshBasicMaterial color="#00ffff" wireframe transparent opacity={0.3} />
                         </mesh>
                         <Center position={[0, 5, 0.6]}>
                             <Text3D font={FONT_URL} size={1.2} height={0.2}>
                                 CYBER SHOP
                                 <meshBasicMaterial color="#ffff00" />
                             </Text3D>
                         </Center>
                         <mesh position={[0, 0.1, 0]} rotation={[-Math.PI/2, 0, 0]} geometry={SHOP_FLOOR_GEO} scale={[laneCount * LANE_WIDTH, 1, 1]}>
                             <meshBasicMaterial color="#00ffff" transparent opacity={0.3} />
                         </mesh>
                    </group>
                )}

                {/* --- OBSTACLE --- */}
                {data.type === ObjectType.OBSTACLE && (
                    <group>
                        <mesh geometry={OBSTACLE_GEOMETRY} castShadow receiveShadow>
                             <meshStandardMaterial 
                                 color="#330011"
                                 roughness={0.3} 
                                 metalness={0.8} 
                                 flatShading={true}
                             />
                        </mesh>
                        <mesh scale={[1.02, 1.02, 1.02]} geometry={OBSTACLE_GLOW_GEO}>
                             <meshBasicMaterial color={data.color} wireframe transparent opacity={0.3} />
                        </mesh>
                         <mesh position={[0, -OBSTACLE_HEIGHT/2 + 0.05, 0]} rotation={[-Math.PI/2,0,0]} geometry={OBSTACLE_RING_GEO}>
                             <meshBasicMaterial color={data.color} transparent opacity={0.4} side={THREE.DoubleSide} />
                         </mesh>
                    </group>
                )}

                {/* --- ALIEN --- */}
                {data.type === ObjectType.ALIEN && (
                    <group>
                        <mesh castShadow geometry={ALIEN_BODY_GEO}>
                            <meshStandardMaterial color="#4400cc" metalness={0.8} roughness={0.2} />
                        </mesh>
                        <mesh position={[0, 0.2, 0]} geometry={ALIEN_DOME_GEO}>
                            <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} transparent opacity={0.8} />
                        </mesh>
                        <mesh position={[0.3, 0, 0.3]} geometry={ALIEN_EYE_GEO}><meshBasicMaterial color="#ff00ff" /></mesh>
                        <mesh position={[-0.3, 0, 0.3]} geometry={ALIEN_EYE_GEO}><meshBasicMaterial color="#ff00ff" /></mesh>
                    </group>
                )}

                {/* --- HUNTER DRONE --- */}
                {data.type === ObjectType.DRONE && (
                    <group>
                         <mesh castShadow geometry={DRONE_BODY_GEO}>
                             <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.1} />
                         </mesh>
                         {/* Engines */}
                         <mesh position={[0.6, 0, 0]} rotation={[0,0,Math.PI/2]} geometry={DRONE_ENGINE_GEO}>
                             <meshStandardMaterial color="#333333" />
                         </mesh>
                         <mesh position={[-0.6, 0, 0]} rotation={[0,0,Math.PI/2]} geometry={DRONE_ENGINE_GEO}>
                             <meshStandardMaterial color="#333333" />
                         </mesh>
                         {/* Red Eye */}
                         <mesh position={[0, 0, 0.4]} geometry={DRONE_EYE_GEO}>
                             <meshBasicMaterial color="#ff0000" />
                         </mesh>
                         {/* Engine Glow */}
                         <pointLight color="#ff0000" distance={2} intensity={2} />
                    </group>
                )}

                {/* --- MISSILE --- */}
                {data.type === ObjectType.MISSILE && (
                    <group rotation={[Math.PI / 2, 0, 0]}>
                        <mesh geometry={MISSILE_CORE_GEO}>
                            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={4} />
                        </mesh>
                        <mesh position={[0, 1.0, 0]} geometry={MISSILE_RING_GEO}><meshBasicMaterial color="#ffff00" /></mesh>
                        <mesh position={[0, 0, 0]} geometry={MISSILE_RING_GEO}><meshBasicMaterial color="#ffff00" /></mesh>
                        <mesh position={[0, -1.0, 0]} geometry={MISSILE_RING_GEO}><meshBasicMaterial color="#ffff00" /></mesh>
                    </group>
                )}

                {/* --- GEM --- */}
                {data.type === ObjectType.GEM && (
                    <mesh castShadow geometry={GEM_GEOMETRY}>
                        <meshStandardMaterial color={data.color} roughness={0} metalness={1} emissive={data.color} emissiveIntensity={2} />
                    </mesh>
                )}

                 {/* --- POWERUPS --- */}
                 {data.type === ObjectType.MAGNET && (
                     <group>
                         <mesh geometry={MAGNET_GEO}>
                             <meshStandardMaterial color="#d000ff" metalness={0.8} roughness={0.2} emissive="#d000ff" emissiveIntensity={1} />
                         </mesh>
                         {/* Pulsing Effect */}
                         <mesh scale={[1.2,1.2,1.2]} geometry={MAGNET_GEO}>
                             <meshBasicMaterial color="#ffffff" transparent opacity={0.3} wireframe />
                         </mesh>
                     </group>
                 )}
                 {data.type === ObjectType.SHIELD && (
                     <group>
                         <mesh geometry={SHIELD_GEO}>
                             <meshStandardMaterial color="#00ffff" metalness={0.5} roughness={0.1} emissive="#00ffff" emissiveIntensity={0.5} transparent opacity={0.8} />
                         </mesh>
                         <mesh scale={[1.1,1.1,1.1]} geometry={SHIELD_GEO}>
                             <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.3} />
                         </mesh>
                     </group>
                 )}

                 {/* --- LASER GATE --- */}
                 {data.type === ObjectType.LASER_GATE && (
                     <group>
                         {/* Left Post */}
                         <mesh position={[-((parseInt(data.value || '3') / 2) * LANE_WIDTH + 0.5), 1.5, 0]} geometry={LASER_POST_GEO}>
                             <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
                         </mesh>
                         {/* Right Post */}
                         <mesh position={[((parseInt(data.value || '3') / 2) * LANE_WIDTH + 0.5), 1.5, 0]} geometry={LASER_POST_GEO}>
                             <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
                         </mesh>
                         {/* Laser Beam */}
                         <mesh position={[0, 0.8, 0]} scale={[(parseInt(data.value || '3')) * LANE_WIDTH + 1, 1, 1]} geometry={LASER_BEAM_GEO}>
                             <meshBasicMaterial color="#ff0000" transparent opacity={0.8} />
                         </mesh>
                         {/* Glow */}
                         <mesh position={[0, 0.8, 0]} scale={[(parseInt(data.value || '3')) * LANE_WIDTH + 1.2, 1.5, 1.5]} geometry={LASER_BEAM_GEO}>
                             <meshBasicMaterial color="#ff0000" transparent opacity={0.3} />
                         </mesh>
                         <pointLight color="#ff0000" distance={5} intensity={2} position={[0, 0.8, 0]} />
                     </group>
                 )}

                 {/* --- MOVING BARRIER --- */}
                 {data.type === ObjectType.BARRIER && (
                     <group>
                         <mesh geometry={BARRIER_GEO} castShadow>
                             <meshStandardMaterial color="#ff6600" metalness={0.7} roughness={0.3} />
                         </mesh>
                         <mesh scale={[1.1, 1.1, 1.1]} geometry={BARRIER_GEO}>
                             <meshBasicMaterial color="#ffaa00" wireframe transparent opacity={0.4} />
                         </mesh>
                     </group>
                 )}

                 {/* --- SPIKE FLOOR --- */}
                 {data.type === ObjectType.SPIKE_FLOOR && (
                     <group>
                         {/* Multiple spikes in a row */}
                         {[-0.6, -0.2, 0.2, 0.6].map((offset, i) => (
                             <mesh key={i} position={[offset, 0.4, 0]} geometry={SPIKE_GEO}>
                                 <meshStandardMaterial color="#cc0000" metalness={0.9} roughness={0.1} />
                             </mesh>
                         ))}
                         {/* Base plate */}
                         <mesh position={[0, 0.05, 0]} rotation={[-Math.PI/2, 0, 0]}>
                             <planeGeometry args={[1.8, 0.8]} />
                             <meshStandardMaterial color="#660000" />
                         </mesh>
                     </group>
                 )}

                 {/* --- TURRET --- */}
                 {data.type === ObjectType.TURRET && (
                     <group>
                         <mesh geometry={TURRET_BASE_GEO}>
                             <meshStandardMaterial color="#444444" metalness={0.8} roughness={0.2} />
                         </mesh>
                         <mesh position={[0, 0.3, 0.3]} rotation={[Math.PI/4, 0, 0]} geometry={TURRET_BARREL_GEO}>
                             <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.1} />
                         </mesh>
                         {/* Warning light */}
                         <mesh position={[0, 0.4, 0]}>
                             <sphereGeometry args={[0.1]} />
                             <meshBasicMaterial color="#ff0000" />
                         </mesh>
                         <pointLight color="#ff0000" distance={2} intensity={1} position={[0, 0.4, 0]} />
                     </group>
                 )}

                 {/* --- JUMP PAD --- */}
                 {data.type === ObjectType.JUMP_PAD && (
                     <group>
                         <mesh geometry={JUMP_PAD_GEO}>
                             <meshStandardMaterial color="#00ff88" metalness={0.6} roughness={0.2} emissive="#00ff88" emissiveIntensity={0.5} />
                         </mesh>
                         <mesh position={[0, 0.1, 0]} scale={[1.2, 1, 1.2]} geometry={JUMP_PAD_GEO}>
                             <meshBasicMaterial color="#00ffaa" wireframe transparent opacity={0.5} />
                         </mesh>
                     </group>
                 )}

                 {/* --- SPEED BOOST --- */}
                 {data.type === ObjectType.SPEED_BOOST && (
                     <group rotation={[0, 0, -Math.PI/2]}>
                         <mesh geometry={SPEED_BOOST_GEO}>
                             <meshStandardMaterial color="#ffaa00" metalness={0.7} roughness={0.2} emissive="#ffaa00" emissiveIntensity={1} />
                         </mesh>
                         <mesh scale={[1.2, 1.2, 1.2]} geometry={SPEED_BOOST_GEO}>
                             <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.4} />
                         </mesh>
                     </group>
                 )}


                {/* --- LETTER --- */}
                {data.type === ObjectType.LETTER && (
                    <group scale={[1.5, 1.5, 1.5]}>
                         <Center>
                             <Text3D 
                                font={FONT_URL} 
                                size={0.8} 
                                height={0.5} 
                                bevelEnabled
                                bevelThickness={0.02}
                                bevelSize={0.02}
                                bevelSegments={5}
                             >
                                {data.value}
                                <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={1.5} />
                             </Text3D>
                         </Center>
                    </group>
                )}
            </group>
        </group>
    );
});
