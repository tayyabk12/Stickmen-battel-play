import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  ACCESSORIES,
  ARENA_RADIUS,
  DEFAULT_ROUND_DURATION_SEC,
  DEFAULT_TOTAL_ROUNDS,
  STICK_COLORS,
  type AccessoryType,
  type AnimState,
  type ArenaHazardData,
  type CombatHitData,
  type GameMode,
  type LootRarity,
  type MapZoneId,
  type PickupData,
  type PlayerCustomization,
  type PlayerProgression,
  type RoomData,
  type RoomPlayerData,
  type RoundPhase,
  type TeamId,
  type UserProfile,
  type UtilityRarity,
  type WeaponCategory,
} from '../types/game';
import { generateArenaObstacles, generatePickupsForRoom } from './arena';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// --- Startup Firestore Connection Validation ---
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

// --- Structured Firestore Error Handling ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Defensive Payload Sanitizers (Synchronized with firebase-blueprint.json) ---
const VALID_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const VALID_ACCESSORY_SET = new Set<string>(ACCESSORIES.map((a) => a.id));
const VALID_ROOM_CODE_RE = /^[A-Z0-9]{4,8}$/;
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function sanitizeDisplayName(name: string): string {
  const cleaned = name.replace(/[^\w\s-]/g, '').trim().slice(0, 20);
  return cleaned.length > 0 ? cleaned : 'StickFighter';
}

export function sanitizeColor(color: string): string {
  return VALID_COLOR_RE.test(color) ? color : STICK_COLORS[0].hex;
}

export function sanitizeAccessory(accessory: string): AccessoryType {
  return VALID_ACCESSORY_SET.has(accessory) ? (accessory as AccessoryType) : 'none';
}

export function sanitizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function isValidRoomCodeFormat(code: string): boolean {
  return VALID_ROOM_CODE_RE.test(code);
}

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  }
  return code;
}

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

function parseRoomDoc(d: Record<string, unknown>): RoomData {
  const totalRounds = clamp(Number(d.totalRounds ?? DEFAULT_TOTAL_ROUNDS), 1, 6);
  const roundDurationSec = clamp(Number(d.roundDurationSec ?? DEFAULT_ROUND_DURATION_SEC), 30, 90);
  return {
    roomId: String(d.roomId),
    hostId: String(d.hostId),
    status: (d.status === 'playing' || d.status === 'ended' ? d.status : 'lobby') as RoomData['status'],
    gameMode: (d.gameMode === 'survival' ? 'survival' : 'tdm') as GameMode,
    totalRounds,
    currentRound: clamp(Number(d.currentRound ?? 1), 1, totalRounds),
    roundDurationSec,
    roundPhase: (d.roundPhase === 'intermission' ? 'intermission' : 'active') as RoundPhase,
    redScore: Number(d.redScore ?? 0),
    blueScore: Number(d.blueScore ?? 0),
    redRoundsWon: Number(d.redRoundsWon ?? 0),
    blueRoundsWon: Number(d.blueRoundsWon ?? 0),
    arenaRadius: Number(d.arenaRadius ?? ARENA_RADIUS),
    zoneRadius: Number(d.zoneRadius ?? ARENA_RADIUS),
    zoneTargetRadius: Number(d.zoneTargetRadius ?? Math.round(ARENA_RADIUS * 0.72)),
    zoneCenterX: Number(d.zoneCenterX ?? 0),
    zoneCenterY: Number(d.zoneCenterY ?? 0),
    matchDurationSec: Number(d.matchDurationSec ?? totalRounds * roundDurationSec),
    timeRemainingSec: Number(d.timeRemainingSec ?? roundDurationSec),
    maxPlayers: Number(d.maxPlayers ?? 8),
    winnerId: String(d.winnerId || ''),
    winnerName: String(d.winnerName || ''),
    seed: Number(d.seed ?? 1),
  };
}

// --- Authentication Helpers ---
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signInAsGuest(): Promise<User> {
  const result = await signInAnonymously(auth);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

// --- User Profile Persistence (/users/{userId}) ---
export async function loadOrCreateUserProfile(
  uid: string,
  fallback: PlayerCustomization,
  fallbackProgression?: PlayerProgression
): Promise<UserProfile> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        userId: uid,
        displayName: sanitizeDisplayName(String(data.displayName || fallback.displayName)),
        color: sanitizeColor(String(data.color || fallback.color)),
        accessory: sanitizeAccessory(String(data.accessory || fallback.accessory)),
        wins: typeof data.wins === 'number' ? data.wins : 0,
        matchesPlayed: typeof data.matchesPlayed === 'number' ? data.matchesPlayed : 0,
        coins: clamp(Number(data.coins ?? fallbackProgression?.coins ?? 0), 0, 1000000),
        xp: clamp(Number(data.xp ?? fallbackProgression?.xp ?? 0), 0, 100000),
        level: clamp(Number(data.level ?? fallbackProgression?.level ?? 1), 1, 50),
        gunLevels: {
          close: clamp(Number(data.gunCloseLevel ?? fallbackProgression?.gunLevels.close ?? 1), 1, 5),
          mid: clamp(Number(data.gunMidLevel ?? fallbackProgression?.gunLevels.mid ?? 1), 1, 5),
          long: clamp(Number(data.gunLongLevel ?? fallbackProgression?.gunLevels.long ?? 1), 1, 5),
        },
      };
    }

    const baseCoins = clamp(fallbackProgression?.coins ?? 0, 0, 1000000);
    const baseXp = clamp(fallbackProgression?.xp ?? 0, 0, 100000);
    const baseLevel = clamp(fallbackProgression?.level ?? 1, 1, 50);
    const baseGunClose = clamp(fallbackProgression?.gunLevels.close ?? 1, 1, 5);
    const baseGunMid = clamp(fallbackProgression?.gunLevels.mid ?? 1, 1, 5);
    const baseGunLong = clamp(fallbackProgression?.gunLevels.long ?? 1, 1, 5);

    const initial: UserProfile = {
      userId: uid,
      displayName: sanitizeDisplayName(fallback.displayName),
      color: sanitizeColor(fallback.color),
      accessory: sanitizeAccessory(fallback.accessory),
      wins: 0,
      matchesPlayed: 0,
      coins: baseCoins,
      xp: baseXp,
      level: baseLevel,
      gunLevels: {
        close: baseGunClose,
        mid: baseGunMid,
        long: baseGunLong,
      },
    };

    await setDoc(ref, {
      userId: initial.userId,
      displayName: initial.displayName,
      color: initial.color,
      accessory: initial.accessory,
      wins: 0,
      matchesPlayed: 0,
      coins: baseCoins,
      xp: baseXp,
      level: baseLevel,
      gunCloseLevel: baseGunClose,
      gunMidLevel: baseGunMid,
      gunLongLevel: baseGunLong,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return initial;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveUserCustomization(
  uid: string,
  custom: PlayerCustomization
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: sanitizeDisplayName(custom.displayName),
      color: sanitizeColor(custom.color),
      accessory: sanitizeAccessory(custom.accessory),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveUserProgression(
  uid: string,
  progression: PlayerProgression
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      coins: Math.round(clamp(progression.coins, 0, 1000000)),
      xp: Math.round(clamp(progression.xp, 0, 100000)),
      level: Math.round(clamp(progression.level, 1, 50)),
      gunCloseLevel: Math.round(clamp(progression.gunLevels.close, 1, 5)),
      gunMidLevel: Math.round(clamp(progression.gunLevels.mid, 1, 5)),
      gunLongLevel: Math.round(clamp(progression.gunLevels.long, 1, 5)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recordUserMatchResult(
  uid: string,
  won: boolean,
  currentWins: number,
  currentMatches: number,
  progression?: PlayerProgression
): Promise<void> {
  const path = `users/${uid}`;
  const payload: Record<string, unknown> = {
    wins: clamp(currentWins + (won ? 1 : 0), 0, 100000),
    matchesPlayed: clamp(currentMatches + 1, 0, 100000),
    updatedAt: serverTimestamp(),
  };
  if (progression) {
    payload.coins = Math.round(clamp(progression.coins, 0, 1000000));
    payload.xp = Math.round(clamp(progression.xp, 0, 100000));
    payload.level = Math.round(clamp(progression.level, 1, 50));
    payload.gunCloseLevel = Math.round(clamp(progression.gunLevels.close, 1, 5));
    payload.gunMidLevel = Math.round(clamp(progression.gunLevels.mid, 1, 5));
    payload.gunLongLevel = Math.round(clamp(progression.gunLevels.long, 1, 5));
  }
  try {
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Room Lifecycle (/rooms/{roomId}) ---
export async function createPrivateRoom(
  hostUid: string,
  hostCustom: PlayerCustomization,
  gameMode: GameMode = 'tdm',
  roundDurationSec = DEFAULT_ROUND_DURATION_SEC,
  totalRounds = DEFAULT_TOTAL_ROUNDS
): Promise<RoomData> {
  const roomId = generateRoomCode();
  const roomPath = `rooms/${roomId}`;
  const seed = Math.floor(Math.random() * 1_000_000) + 1;
  // Anchor shrinking safe zone near the central Resource Zone (Sundial Vault)
  const zoneCenterX = Math.round((Math.random() - 0.5) * 90);
  const zoneCenterY = Math.round((Math.random() - 0.5) * 90);
  const clampedRounds = clamp(Math.round(totalRounds), 1, 6);
  const clampedRoundSec = clamp(Math.round(roundDurationSec), 30, 90);
  const matchDurationSec = clamp(clampedRounds * clampedRoundSec, 90, 300);

  const roomPayload: RoomData = {
    roomId,
    hostId: hostUid,
    status: 'lobby',
    gameMode,
    totalRounds: clampedRounds,
    currentRound: 1,
    roundDurationSec: clampedRoundSec,
    roundPhase: 'active',
    redScore: 0,
    blueScore: 0,
    redRoundsWon: 0,
    blueRoundsWon: 0,
    arenaRadius: ARENA_RADIUS,
    zoneRadius: ARENA_RADIUS,
    zoneTargetRadius: Math.round(ARENA_RADIUS * 0.72),
    zoneCenterX,
    zoneCenterY,
    matchDurationSec,
    timeRemainingSec: clampedRoundSec,
    maxPlayers: 8,
    winnerId: '',
    winnerName: '',
    seed,
  };

  try {
    await setDoc(doc(db, 'rooms', roomId), {
      ...roomPayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, roomPath);
  }

  await joinPrivateRoomPlayer(roomId, hostUid, hostCustom, true, gameMode === 'tdm' ? 'red' : 'none');
  return roomPayload;
}

export async function fetchRoomByCode(rawCode: string): Promise<RoomData | null> {
  const roomId = sanitizeRoomCode(rawCode);
  if (!isValidRoomCodeFormat(roomId)) return null;
  const path = `rooms/${roomId}`;
  try {
    const snap = await getDoc(doc(db, 'rooms', roomId));
    if (!snap.exists()) return null;
    return parseRoomDoc(snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function joinPrivateRoomPlayer(
  roomId: string,
  uid: string,
  custom: PlayerCustomization,
  isReady = false,
  team: TeamId = 'red'
): Promise<void> {
  const playerPath = `rooms/${roomId}/players/${uid}`;
  const angle = Math.random() * Math.PI * 2;
  const spawnDist = ARENA_RADIUS * 0.55;
  const x = Math.round(Math.cos(angle) * spawnDist);
  const y = Math.round(Math.sin(angle) * spawnDist);

  try {
    const ref = doc(db, 'rooms', roomId, 'players', uid);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        displayName: sanitizeDisplayName(custom.displayName),
        color: sanitizeColor(custom.color),
        accessory: sanitizeAccessory(custom.accessory),
        team,
        isReady,
        x,
        y,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        playerId: uid,
        roomId,
        displayName: sanitizeDisplayName(custom.displayName),
        color: sanitizeColor(custom.color),
        accessory: sanitizeAccessory(custom.accessory),
        team,
        x,
        y,
        vx: 0,
        vy: 0,
        facing: 0,
        animState: 'idle',
        health: 100,
        shield: 0,
        speedBoostSec: 0,
        damageBoostSec: 0,
        kills: 0,
        deaths: 0,
        points: 0,
        damageDealt: 0,
        roundWins: 0,
        status: 'alive',
        isReady,
        lastHitBy: '',
        lastAttackSeq: 0,
        weaponCategory: 'close',
        weaponRarity: 'common',
        utilityRarity: 'none',
        utilityCharges: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, playerPath);
  }
}

export async function updateLobbyPlayerProfile(
  roomId: string,
  uid: string,
  custom: PlayerCustomization,
  isReady: boolean,
  team?: TeamId
): Promise<void> {
  const path = `rooms/${roomId}/players/${uid}`;
  const payload: Record<string, unknown> = {
    displayName: sanitizeDisplayName(custom.displayName),
    color: sanitizeColor(custom.color),
    accessory: sanitizeAccessory(custom.accessory),
    isReady,
    updatedAt: serverTimestamp(),
  };
  if (team) {
    payload.team = team;
  }
  try {
    await updateDoc(doc(db, 'rooms', roomId, 'players', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateLobbyRoomConfig(
  roomId: string,
  config: { gameMode?: GameMode; totalRounds?: number; roundDurationSec?: number }
): Promise<void> {
  const path = `rooms/${roomId}`;
  const rounds = clamp(Math.round(config.totalRounds ?? DEFAULT_TOTAL_ROUNDS), 1, 6);
  const roundSec = clamp(Math.round(config.roundDurationSec ?? DEFAULT_ROUND_DURATION_SEC), 30, 90);
  const matchDurationSec = clamp(rounds * roundSec, 90, 300);
  const payload: Record<string, unknown> = {
    totalRounds: rounds,
    roundDurationSec: roundSec,
    matchDurationSec,
    timeRemainingSec: roundSec,
    updatedAt: serverTimestamp(),
  };
  if (config.gameMode) {
    payload.gameMode = config.gameMode;
  }
  try {
    await updateDoc(doc(db, 'rooms', roomId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function leavePrivateRoom(roomId: string, uid: string): Promise<void> {
  const path = `rooms/${roomId}/players/${uid}`;
  try {
    await deleteDoc(doc(db, 'rooms', roomId, 'players', uid));
  } catch (error) {
    console.warn('Leave room cleanup notice:', path, error);
  }
}

export async function startRoomMatch(room: RoomData): Promise<void> {
  const obstacles = generateArenaObstacles(room.seed);
  const pickups = generatePickupsForRoom(room.roomId, room.seed, obstacles, 1);
  const roomPath = `rooms/${room.roomId}`;

  try {
    const batch = writeBatch(db);
    for (const pk of pickups) {
      const pkRef = doc(db, 'rooms', room.roomId, 'pickups', pk.pickupId);
      batch.set(pkRef, {
        ...pk,
        claimedBy: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    batch.update(doc(db, 'rooms', room.roomId), {
      status: 'playing',
      currentRound: 1,
      roundPhase: 'active',
      redScore: 0,
      blueScore: 0,
      redRoundsWon: 0,
      blueRoundsWon: 0,
      zoneRadius: room.arenaRadius,
      zoneTargetRadius: Math.round(room.arenaRadius * 0.72),
      zoneCenterX: room.zoneCenterX,
      zoneCenterY: room.zoneCenterY,
      timeRemainingSec: room.roundDurationSec,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, roomPath);
  }
}

export async function startNextRoomRound(
  room: RoomData,
  nextRound: number,
  redScore: number,
  blueScore: number,
  redRoundsWon: number,
  blueRoundsWon: number
): Promise<void> {
  const obstacles = generateArenaObstacles(room.seed);
  const pickups = generatePickupsForRoom(room.roomId, room.seed, obstacles, nextRound);
  const roomPath = `rooms/${room.roomId}`;
  const nextCenterX = Math.round((Math.random() - 0.5) * 90);
  const nextCenterY = Math.round((Math.random() - 0.5) * 90);

  try {
    const batch = writeBatch(db);
    for (const pk of pickups) {
      const pkRef = doc(db, 'rooms', room.roomId, 'pickups', pk.pickupId);
      batch.set(pkRef, {
        ...pk,
        claimedBy: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    batch.update(doc(db, 'rooms', room.roomId), {
      currentRound: clamp(nextRound, 1, room.totalRounds),
      roundPhase: 'active',
      redScore: Math.round(clamp(redScore, 0, 100000)),
      blueScore: Math.round(clamp(blueScore, 0, 100000)),
      redRoundsWon: clamp(redRoundsWon, 0, 6),
      blueRoundsWon: clamp(blueRoundsWon, 0, 6),
      zoneRadius: room.arenaRadius,
      zoneTargetRadius: Math.round(room.arenaRadius * 0.72),
      zoneCenterX: nextCenterX,
      zoneCenterY: nextCenterY,
      timeRemainingSec: room.roundDurationSec,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('PERMISSION_DENIED')) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }
}

/** 2-5 Hz player state & per-avatar score sync (writes strictly to own player document) */
export async function syncLocalPlayerState(
  roomId: string,
  uid: string,
  state: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing: number;
    animState: AnimState;
    health: number;
    shield: number;
    speedBoostSec: number;
    damageBoostSec: number;
    kills: number;
    deaths: number;
    points: number;
    damageDealt: number;
    roundWins: number;
    status: 'alive' | 'downed';
    lastHitBy: string;
    lastAttackSeq: number;
    weaponCategory: WeaponCategory;
    weaponRarity: LootRarity;
    utilityRarity: UtilityRarity;
    utilityCharges: number;
  }
): Promise<void> {
  const path = `rooms/${roomId}/players/${uid}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId, 'players', uid), {
      x: Math.round(clamp(state.x, -900, 900) * 10) / 10,
      y: Math.round(clamp(state.y, -900, 900) * 10) / 10,
      vx: Math.round(clamp(state.vx, -800, 800)),
      vy: Math.round(clamp(state.vy, -800, 800)),
      facing: Math.round(clamp(state.facing, -6.28, 6.28) * 100) / 100,
      animState: state.animState,
      health: Math.round(clamp(state.health, 0, 100)),
      shield: Math.round(clamp(state.shield, 0, 50)),
      speedBoostSec: Math.round(clamp(state.speedBoostSec, 0, 15) * 10) / 10,
      damageBoostSec: Math.round(clamp(state.damageBoostSec, 0, 15) * 10) / 10,
      kills: Math.round(clamp(state.kills, 0, 200)),
      deaths: Math.round(clamp(state.deaths, 0, 200)),
      points: Math.round(clamp(state.points, 0, 100000)),
      damageDealt: Math.round(clamp(state.damageDealt, 0, 50000)),
      roundWins: Math.round(clamp(state.roundWins, 0, 6)),
      status: state.status,
      lastHitBy: state.lastHitBy.slice(0, 128),
      lastAttackSeq: Math.round(clamp(state.lastAttackSeq, 0, 100000)),
      weaponCategory: state.weaponCategory,
      weaponRarity: state.weaponRarity,
      utilityRarity: state.utilityRarity,
      utilityCharges: Math.round(clamp(state.utilityCharges, 0, 5)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('PERMISSION_DENIED')) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function syncHostZoneTick(
  roomId: string,
  payload: {
    currentRound: number;
    roundPhase: RoundPhase;
    redScore: number;
    blueScore: number;
    redRoundsWon: number;
    blueRoundsWon: number;
    zoneRadius: number;
    zoneTargetRadius: number;
    zoneCenterX: number;
    zoneCenterY: number;
    timeRemainingSec: number;
  }
): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      currentRound: Math.round(clamp(payload.currentRound, 1, 6)),
      roundPhase: payload.roundPhase,
      redScore: Math.round(clamp(payload.redScore, 0, 100000)),
      blueScore: Math.round(clamp(payload.blueScore, 0, 100000)),
      redRoundsWon: Math.round(clamp(payload.redRoundsWon, 0, 6)),
      blueRoundsWon: Math.round(clamp(payload.blueRoundsWon, 0, 6)),
      zoneRadius: Math.round(clamp(payload.zoneRadius, 0, 1200) * 10) / 10,
      zoneTargetRadius: Math.round(clamp(payload.zoneTargetRadius, 0, 1200) * 10) / 10,
      zoneCenterX: Math.round(clamp(payload.zoneCenterX, -400, 400)),
      zoneCenterY: Math.round(clamp(payload.zoneCenterY, -400, 400)),
      timeRemainingSec: Math.round(clamp(payload.timeRemainingSec, 0, 300)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('PERMISSION_DENIED')) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function finishRoomMatch(
  roomId: string,
  winnerId: string,
  winnerName: string,
  timeRemainingSec: number,
  scores: {
    redScore: number;
    blueScore: number;
    redRoundsWon: number;
    blueRoundsWon: number;
  }
): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      status: 'ended',
      roundPhase: 'intermission',
      redScore: Math.round(clamp(scores.redScore, 0, 100000)),
      blueScore: Math.round(clamp(scores.blueScore, 0, 100000)),
      redRoundsWon: Math.round(clamp(scores.redRoundsWon, 0, 6)),
      blueRoundsWon: Math.round(clamp(scores.blueRoundsWon, 0, 6)),
      winnerId: winnerId.slice(0, 128),
      winnerName: winnerName.slice(0, 24),
      timeRemainingSec: Math.round(clamp(timeRemainingSec, 0, 300)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('PERMISSION_DENIED')) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function claimRoomPickup(
  roomId: string,
  pickupId: string,
  uid: string
): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'rooms', roomId, 'pickups', pickupId), {
      active: false,
      claimedBy: uid,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function emitRoomCombatHit(
  roomId: string,
  attackerId: string,
  targetId: string,
  damage: number,
  knockbackX: number,
  knockbackY: number
): Promise<void> {
  const hitId = `h_${Date.now()}_${Math.floor(Math.random() * 99999)}`;
  const path = `rooms/${roomId}/hits/${hitId}`;
  try {
    await setDoc(doc(db, 'rooms', roomId, 'hits', hitId), {
      hitId,
      roomId,
      attackerId,
      targetId,
      damage: Math.round(clamp(damage, 1, 95)),
      knockbackX: Math.round(clamp(knockbackX, -400, 400)),
      knockbackY: Math.round(clamp(knockbackY, -400, 400)),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('PERMISSION_DENIED')) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

export async function emitRoomHazard(
  roomId: string,
  ownerId: string,
  rarity: 'uncommon' | 'rare',
  x: number,
  y: number,
  radius: number,
  durationSec: number
): Promise<void> {
  const hazardId = `hz_${Date.now()}_${Math.floor(Math.random() * 99999)}`;
  const path = `rooms/${roomId}/hazards/${hazardId}`;
  try {
    await setDoc(doc(db, 'rooms', roomId, 'hazards', hazardId), {
      hazardId,
      roomId,
      ownerId,
      kind: 'shroud_snare',
      rarity,
      x: Math.round(clamp(x, -850, 850)),
      y: Math.round(clamp(y, -850, 850)),
      radius: Math.round(clamp(radius, 60, 160)),
      durationSec: Math.round(clamp(durationSec, 4, 12) * 10) / 10,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('PERMISSION_DENIED')) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

// --- Realtime Subscriptions (Scoped with where('roomId', '==', roomId) for Pillar 8) ---
export function subscribeToRoom(
  roomId: string,
  onData: (room: RoomData | null) => void
): Unsubscribe {
  const path = `rooms/${roomId}`;
  return onSnapshot(
    doc(db, 'rooms', roomId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(parseRoomDoc(snap.data() as Record<string, unknown>));
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export function subscribeToRoomPlayers(
  roomId: string,
  onData: (players: RoomPlayerData[]) => void
): Unsubscribe {
  const path = `rooms/${roomId}/players`;
  const q = query(collection(db, 'rooms', roomId, 'players'), where('roomId', '==', roomId));
  return onSnapshot(
    q,
    (snapshot) => {
      const players: RoomPlayerData[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const ts = d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : Date.now();
        return {
          playerId: String(d.playerId),
          roomId: String(d.roomId),
          displayName: String(d.displayName || 'Fighter'),
          color: sanitizeColor(String(d.color || '#EF4444')),
          accessory: sanitizeAccessory(String(d.accessory || 'none')),
          team: (d.team === 'red' || d.team === 'blue' ? d.team : 'none') as TeamId,
          x: Number(d.x || 0),
          y: Number(d.y || 0),
          vx: Number(d.vx || 0),
          vy: Number(d.vy || 0),
          facing: Number(d.facing || 0),
          animState: (d.animState || 'idle') as AnimState,
          health: Number(d.health ?? 100),
          shield: Number(d.shield ?? 0),
          speedBoostSec: Number(d.speedBoostSec ?? 0),
          damageBoostSec: Number(d.damageBoostSec ?? 0),
          kills: Number(d.kills ?? 0),
          deaths: Number(d.deaths ?? 0),
          points: Number(d.points ?? 0),
          damageDealt: Number(d.damageDealt ?? 0),
          roundWins: Number(d.roundWins ?? 0),
          status: (d.status === 'downed' ? 'downed' : 'alive') as 'alive' | 'downed',
          isReady: Boolean(d.isReady),
          lastHitBy: String(d.lastHitBy || ''),
          lastAttackSeq: Number(d.lastAttackSeq || 0),
          weaponCategory: (d.weaponCategory === 'mid' || d.weaponCategory === 'long'
            ? d.weaponCategory
            : 'close') as WeaponCategory,
          weaponRarity: (d.weaponRarity === 'uncommon' || d.weaponRarity === 'rare'
            ? d.weaponRarity
            : 'common') as LootRarity,
          utilityRarity: (d.utilityRarity === 'uncommon' || d.utilityRarity === 'rare'
            ? d.utilityRarity
            : 'none') as UtilityRarity,
          utilityCharges: Number(d.utilityCharges || 0),
          updatedAtMs: ts,
        };
      });
      onData(players);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeToRoomPickups(
  roomId: string,
  onData: (pickups: PickupData[]) => void
): Unsubscribe {
  const path = `rooms/${roomId}/pickups`;
  const q = query(collection(db, 'rooms', roomId, 'pickups'), where('roomId', '==', roomId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: PickupData[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          pickupId: String(d.pickupId),
          roomId: String(d.roomId),
          type: d.type as PickupData['type'],
          rarity: (d.rarity === 'uncommon' || d.rarity === 'rare'
            ? d.rarity
            : 'common') as LootRarity,
          zone: (d.zone === 'resource' || d.zone === 'dense' || d.zone === 'open'
            ? d.zone
            : 'flank') as MapZoneId,
          x: Number(d.x || 0),
          y: Number(d.y || 0),
          active: Boolean(d.active),
          claimedBy: String(d.claimedBy || ''),
        };
      });
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeToRoomHits(
  roomId: string,
  onNewHit: (hit: CombatHitData) => void
): Unsubscribe {
  const path = `rooms/${roomId}/hits`;
  const seen = new Set<string>();
  const q = query(collection(db, 'rooms', roomId, 'hits'), where('roomId', '==', roomId));
  return onSnapshot(
    q,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const d = change.doc.data();
          const hitId = String(d.hitId || change.doc.id);
          if (seen.has(hitId)) return;
          seen.add(hitId);
          onNewHit({
            hitId,
            roomId: String(d.roomId),
            attackerId: String(d.attackerId),
            targetId: String(d.targetId),
            damage: Number(d.damage || 15),
            knockbackX: Number(d.knockbackX || 0),
            knockbackY: Number(d.knockbackY || 0),
          });
        }
      });
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeToRoomHazards(
  roomId: string,
  onNewHazard: (hazard: ArenaHazardData) => void
): Unsubscribe {
  const path = `rooms/${roomId}/hazards`;
  const seen = new Set<string>();
  const q = query(collection(db, 'rooms', roomId, 'hazards'), where('roomId', '==', roomId));
  return onSnapshot(
    q,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const d = change.doc.data();
          const hazardId = String(d.hazardId || change.doc.id);
          if (seen.has(hazardId)) return;
          seen.add(hazardId);
          const createdAtMs =
            d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now();
          onNewHazard({
            hazardId,
            roomId: String(d.roomId),
            ownerId: String(d.ownerId),
            kind: 'shroud_snare',
            rarity: d.rarity === 'rare' ? 'rare' : 'uncommon',
            x: Number(d.x || 0),
            y: Number(d.y || 0),
            radius: Number(d.radius || 108),
            durationSec: Number(d.durationSec || 6.5),
            createdAtMs,
          });
        }
      });
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}
