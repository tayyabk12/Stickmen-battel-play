export type AccessoryType =
  | 'none'
  | 'crown'
  | 'headband'
  | 'horns'
  | 'halo'
  | 'tophat'
  | 'mohawk'
  | 'shades';

export type AnimState = 'idle' | 'walk' | 'run' | 'attack' | 'hit' | 'downed';

export type MapZoneId = 'resource' | 'dense' | 'open' | 'flank';

export type WeaponCategory = 'close' | 'mid' | 'long';

export type LootRarity = 'common' | 'uncommon' | 'rare';

export type UtilityRarity = 'none' | 'uncommon' | 'rare';

export type GameMode = 'tdm' | 'survival';

export type TeamId = 'none' | 'red' | 'blue';

export type RoundPhase = 'active' | 'intermission';

export type PickupType =
  | 'medkit'
  | 'shield'
  | 'speed'
  | 'power'
  | 'close'
  | 'mid'
  | 'long'
  | 'utility';

export type RoomStatus = 'lobby' | 'playing' | 'ended';

export type AppScreen = 'TITLE' | 'LOBBY' | 'PLAYING_SOLO' | 'PLAYING_MULTI';

export const STICK_COLORS: { name: string; hex: string }[] = [
  { name: 'Crimson', hex: '#EF4444' },
  { name: 'Cobalt', hex: '#3B82F6' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Violet', hex: '#A855F7' },
  { name: 'Coral', hex: '#FB7185' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Lime', hex: '#84CC16' },
];

export const ACCESSORIES: { id: AccessoryType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'crown', label: 'Crown' },
  { id: 'headband', label: 'Headband' },
  { id: 'horns', label: 'Horns' },
  { id: 'halo', label: 'Halo' },
  { id: 'tophat', label: 'Top Hat' },
  { id: 'mohawk', label: 'Mohawk' },
  { id: 'shades', label: 'Shades' },
];

export const TEAM_META: Record<
  'red' | 'blue',
  { name: string; short: string; color: string; bg: string; border: string }
> = {
  red: {
    name: 'Team Crimson',
    short: 'CRIMSON',
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.16)',
    border: 'rgba(248, 113, 113, 0.7)',
  },
  blue: {
    name: 'Team Cobalt',
    short: 'COBALT',
    color: '#3B82F6',
    bg: 'rgba(59, 130, 246, 0.16)',
    border: 'rgba(96, 165, 250, 0.7)',
  },
};

export const SCORE_RULES = {
  KILL: 100,
  ROUND_WIN: 150,
  RARE_CLAIM: 50,
  SURVIVAL_BONUS: 50,
  DAMAGE_DIVISOR: 10, // +1 point per 10 damage dealt
} as const;

export const MATCH_PRESETS: {
  label: string;
  totalSec: number;
  roundSec: number;
  rounds: number;
}[] = [
  { label: '3:00 (4 × 45s)', totalSec: 180, roundSec: 45, rounds: 4 },
  { label: '4:00 (4 × 60s)', totalSec: 240, roundSec: 60, rounds: 4 },
  { label: '5:00 (4 × 75s)', totalSec: 300, roundSec: 75, rounds: 4 },
];

export const RARITY_RANK: Record<LootRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
};

export const RARITY_META: Record<
  LootRarity,
  { label: string; color: string; bg: string; border: string; glow: string }
> = {
  common: {
    label: 'Common',
    color: '#F8FAFC',
    bg: 'rgba(248, 250, 252, 0.12)',
    border: 'rgba(226, 232, 240, 0.55)',
    glow: 'rgba(248, 250, 252, 0.25)',
  },
  uncommon: {
    label: 'Uncommon',
    color: '#22C55E',
    bg: 'rgba(34, 197, 94, 0.16)',
    border: 'rgba(74, 222, 128, 0.65)',
    glow: 'rgba(34, 197, 94, 0.38)',
  },
  rare: {
    label: 'Rare',
    color: '#FACC15',
    bg: 'rgba(250, 204, 21, 0.2)',
    border: 'rgba(250, 204, 21, 0.9)',
    glow: 'rgba(250, 204, 21, 0.65)',
  },
};

export interface GunLevels {
  close: number;
  mid: number;
  long: number;
}

export interface PlayerProgression {
  coins: number;
  xp: number;
  level: number;
  gunLevels: GunLevels;
}

export const MAX_GUN_LEVEL = 5;
export const MAX_PLAYER_LEVEL = 50;

export const DEFAULT_PLAYER_PROGRESSION: PlayerProgression = {
  coins: 0,
  xp: 0,
  level: 1,
  gunLevels: {
    close: 1,
    mid: 1,
    long: 1,
  },
};

export interface GunUpgradeTier {
  level: number;
  code: string;
  label: string;
  cost: number;
  requiredPlayerLevel: number;
  damageMult: number;
  rangeMult: number;
  cooldownMult: number;
  accent: string;
}

export const GUN_UPGRADE_TIERS: GunUpgradeTier[] = [
  {
    level: 1,
    code: 'MK-I',
    label: 'Standard',
    cost: 0,
    requiredPlayerLevel: 1,
    damageMult: 1.0,
    rangeMult: 1.0,
    cooldownMult: 1.0,
    accent: '#94A3B8',
  },
  {
    level: 2,
    code: 'MK-II',
    label: 'Reinforced',
    cost: 100,
    requiredPlayerLevel: 1,
    damageMult: 1.12,
    rangeMult: 1.05,
    cooldownMult: 0.95,
    accent: '#22C55E',
  },
  {
    level: 3,
    code: 'MK-III',
    label: 'Tactical',
    cost: 220,
    requiredPlayerLevel: 2,
    damageMult: 1.25,
    rangeMult: 1.1,
    cooldownMult: 0.9,
    accent: '#38BDF8',
  },
  {
    level: 4,
    code: 'MK-IV',
    label: 'Overcharged',
    cost: 400,
    requiredPlayerLevel: 4,
    damageMult: 1.38,
    rangeMult: 1.15,
    cooldownMult: 0.85,
    accent: '#F97316',
  },
  {
    level: 5,
    code: 'MK-V',
    label: 'Masterwork',
    cost: 650,
    requiredPlayerLevel: 6,
    damageMult: 1.54,
    rangeMult: 1.22,
    cooldownMult: 0.78,
    accent: '#FACC15',
  },
];

export const COIN_REWARDS = {
  DROP_COIN: 8,
  CACHE_COIN: 15,
  VAULT_COIN: 25,
  ROUND_WIN: 30,
  MATCH_COMPLETE: 25,
  MATCH_VICTORY: 60,
  LEVEL_UP_BONUS: 40,
} as const;

export const XP_REWARDS = {
  COIN_PICKUP: 6,
  KILL: 45,
  RARE_CLAIM: 30,
  ROUND_WIN: 60,
  MATCH_COMPLETE: 50,
  MATCH_VICTORY: 90,
} as const;

export function getXpForNextLevel(level: number): number {
  const lv = Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(level)));
  return 120 + (lv - 1) * 75;
}

export function applyXpGain(
  currentLevel: number,
  currentXp: number,
  xpGain: number
): {
  level: number;
  xp: number;
  leveledUp: boolean;
  levelsGained: number;
  levelUpCoinBonus: number;
} {
  let level = Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(currentLevel)));
  let xp = Math.max(0, Math.floor(currentXp) + Math.max(0, Math.floor(xpGain)));
  let levelsGained = 0;

  while (level < MAX_PLAYER_LEVEL) {
    const needed = getXpForNextLevel(level);
    if (xp < needed) break;
    xp -= needed;
    level += 1;
    levelsGained += 1;
  }

  if (level >= MAX_PLAYER_LEVEL) {
    xp = 0;
  }

  return {
    level,
    xp,
    leveledUp: levelsGained > 0,
    levelsGained,
    levelUpCoinBonus: levelsGained * COIN_REWARDS.LEVEL_UP_BONUS,
  };
}

export function getGunUpgradeTier(level: number): GunUpgradeTier {
  const clamped = Math.max(1, Math.min(MAX_GUN_LEVEL, Math.round(level)));
  return GUN_UPGRADE_TIERS[clamped - 1];
}

export interface WeaponSpec {
  category: WeaponCategory;
  name: string;
  roleLabel: string;
  damage: number;
  range: number;
  cooldownSec: number;
  knockback: number;
  requiresLos: boolean;
  upgradeLevel: number;
  tierCode: string;
}

export const WEAPON_CATALOG: Record<
  WeaponCategory,
  {
    name: string;
    roleLabel: string;
    shortTag: string;
    description: string;
    requiresLos: boolean;
    tiers: Record<LootRarity, { damage: number; range: number; cooldownSec: number; knockback: number }>;
  }
> = {
  close: {
    name: 'Viper Scattergun',
    roleLabel: 'Close-Range Shotgun',
    shortTag: 'SHOTGUN',
    description: 'Twin-bore tactical pump shotgun built for tight maze ambushes & heavy knockback.',
    requiresLos: false,
    tiers: {
      common: { damage: 13, range: 98, cooldownSec: 0.54, knockback: 215 },
      uncommon: { damage: 17, range: 108, cooldownSec: 0.5, knockback: 250 },
      rare: { damage: 22, range: 118, cooldownSec: 0.46, knockback: 285 },
    },
  },
  mid: {
    name: 'Pulse Carbine',
    roleLabel: 'Mid-Range SMG',
    shortTag: 'SMG',
    description: 'Balanced high-cadence assault carbine with holographic sight and rapid burst tracking.',
    requiresLos: true,
    tiers: {
      common: { damage: 10, range: 180, cooldownSec: 0.58, knockback: 105 },
      uncommon: { damage: 13, range: 210, cooldownSec: 0.52, knockback: 125 },
      rare: { damage: 17, range: 240, cooldownSec: 0.46, knockback: 145 },
    },
  },
  long: {
    name: 'Horizon Rail Sniper',
    roleLabel: 'Long-Range Sniper',
    shortTag: 'SNIPER',
    description: 'Long-barrel magnetic rail rifle with precision scope that punishes open-lane crossings.',
    requiresLos: true,
    tiers: {
      common: { damage: 19, range: 295, cooldownSec: 1.48, knockback: 165 },
      uncommon: { damage: 25, range: 345, cooldownSec: 1.36, knockback: 195 },
      rare: { damage: 32, range: 400, cooldownSec: 1.24, knockback: 230 },
    },
  },
};

export function getWeaponSpec(
  category: WeaponCategory,
  rarity: LootRarity,
  upgradeLevel = 1
): WeaponSpec {
  const entry = WEAPON_CATALOG[category];
  const baseTier = entry.tiers[rarity];
  const upg = getGunUpgradeTier(upgradeLevel);
  return {
    category,
    name: entry.name,
    roleLabel: entry.roleLabel,
    requiresLos: entry.requiresLos,
    damage: Math.round(baseTier.damage * upg.damageMult),
    range: Math.round(baseTier.range * upg.rangeMult),
    cooldownSec: Math.round(baseTier.cooldownSec * upg.cooldownMult * 100) / 100,
    knockback: Math.round(baseTier.knockback * (1 + (upg.level - 1) * 0.04)),
    upgradeLevel: upg.level,
    tierCode: upg.code,
  };
}

export const UTILITY_SPEC: Record<
  'uncommon' | 'rare',
  {
    name: string;
    roleLabel: string;
    radius: number;
    durationSec: number;
    slowFactor: number;
    chargesOnPickup: number;
    cooldownSec: number;
  }
> = {
  uncommon: {
    name: 'Shroud Snare',
    roleLabel: 'Area Utility',
    radius: 108,
    durationSec: 6.5,
    slowFactor: 0.58,
    chargesOnPickup: 2,
    cooldownSec: 4.5,
  },
  rare: {
    name: 'Shroud Snare',
    roleLabel: 'Area Utility',
    radius: 138,
    durationSec: 8.5,
    slowFactor: 0.48,
    chargesOnPickup: 3,
    cooldownSec: 3.8,
  },
};

export const MAP_ZONE_META: Record<
  MapZoneId,
  { name: string; tag: string; purpose: string; accent: string }
> = {
  resource: {
    name: 'Sundial Vault',
    tag: 'Resource Zone',
    purpose: 'Rare Gold gear · High exposure',
    accent: '#FACC15',
  },
  dense: {
    name: 'Instrument Maze',
    tag: 'Dense Zone',
    purpose: 'Tight corridors · Close-range & high loot',
    accent: '#F97316',
  },
  open: {
    name: 'Outer Colonnade',
    tag: 'Open Zone',
    purpose: 'Wide sightlines · Long-range lanes',
    accent: '#38BDF8',
  },
  flank: {
    name: 'Crossway Bazaar',
    tag: 'Flank Zone',
    purpose: 'Tactical shortcut · Mid-range & utility',
    accent: '#14B8A6',
  },
};

export function isWeaponPickup(type: PickupType): type is WeaponCategory {
  return type === 'close' || type === 'mid' || type === 'long';
}

export interface PlayerCustomization {
  displayName: string;
  color: string;
  accessory: AccessoryType;
}

export interface UserProfile extends PlayerCustomization {
  userId: string;
  wins: number;
  matchesPlayed: number;
  coins: number;
  xp: number;
  level: number;
  gunLevels: GunLevels;
}

export interface RoomData {
  roomId: string;
  hostId: string;
  status: RoomStatus;
  gameMode: GameMode;
  totalRounds: number;
  currentRound: number;
  roundDurationSec: number;
  roundPhase: RoundPhase;
  redScore: number;
  blueScore: number;
  redRoundsWon: number;
  blueRoundsWon: number;
  arenaRadius: number;
  zoneRadius: number;
  zoneTargetRadius: number;
  zoneCenterX: number;
  zoneCenterY: number;
  matchDurationSec: number;
  timeRemainingSec: number;
  maxPlayers: number;
  winnerId: string;
  winnerName: string;
  seed: number;
}

export interface RoomPlayerData {
  playerId: string;
  roomId: string;
  displayName: string;
  color: string;
  accessory: AccessoryType;
  team: TeamId;
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
  isReady: boolean;
  lastHitBy: string;
  lastAttackSeq: number;
  weaponCategory: WeaponCategory;
  weaponRarity: LootRarity;
  utilityRarity: UtilityRarity;
  utilityCharges: number;
  updatedAtMs?: number;
}

export interface PickupData {
  pickupId: string;
  roomId: string;
  type: PickupType;
  rarity: LootRarity;
  zone: MapZoneId;
  x: number;
  y: number;
  active: boolean;
  claimedBy: string;
}

export interface CombatHitData {
  hitId: string;
  roomId: string;
  attackerId: string;
  targetId: string;
  damage: number;
  knockbackX: number;
  knockbackY: number;
}

export interface ArenaHazardData {
  hazardId: string;
  roomId: string;
  ownerId: string;
  kind: 'shroud_snare';
  rarity: 'uncommon' | 'rare';
  x: number;
  y: number;
  radius: number;
  durationSec: number;
  createdAtMs: number;
}

export interface ActiveHazard {
  id: string;
  ownerId: string;
  ownerTeam: TeamId;
  rarity: 'uncommon' | 'rare';
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  slowFactor: number;
}

export interface Obstacle {
  id: string;
  kind: 'pillar' | 'crate' | 'wall';
  zone: MapZoneId;
  x: number;
  y: number;
  radius: number;
  w?: number;
  h?: number;
}

/** Client-side smoothed fighter entity rendered at 60fps */
export interface FighterEntity {
  id: string;
  displayName: string;
  color: string;
  accessory: AccessoryType;
  team: TeamId;
  isLocal: boolean;
  isBot: boolean;
  // Rendered interpolated position
  x: number;
  y: number;
  // Network target state (for 2-5Hz -> 60fps interpolation)
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  facing: number;
  targetFacing: number;
  animState: AnimState;
  animPhase: number;
  attackTimer: number;
  hitFlashTimer: number;
  dashCooldown: number;
  dashTimer: number;
  attackCooldown: number;
  utilityCooldown: number;
  respawnTimer: number;
  spawnShieldTimer: number;
  lastDamagedAt: number;
  knockbackVx: number;
  knockbackVy: number;
  health: number;
  shield: number;
  speedBoostSec: number;
  damageBoostSec: number;
  kills: number;
  deaths: number;
  points: number;
  damageDealt: number;
  roundWins: number;
  roundKills: number;
  roundDeaths: number;
  roundPoints: number;
  status: 'alive' | 'downed';
  lastHitBy: string;
  lastAttackSeq: number;
  weaponCategory: WeaponCategory;
  weaponRarity: LootRarity;
  utilityRarity: UtilityRarity;
  utilityCharges: number;
  lastSeenMs: number;
  // Bot AI steering
  botGoalX?: number;
  botGoalY?: number;
  botDecisionTimer?: number;
  botBoldness?: number;
}

export interface ArenaCoin {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  kind: 'drop' | 'cache' | 'vault';
  life: number;
  maxLife: number;
  bobPhase: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface SwingArc {
  id: number;
  x: number;
  y: number;
  angle: number;
  color: string;
  life: number;
  maxLife: number;
  powered: boolean;
  radius: number;
}

export interface BeamTrail {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  life: number;
  maxLife: number;
  kind: 'mid' | 'long';
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface KillFeedEntry {
  id: number;
  text: string;
  accent: string;
  expiresAt: number;
}

export interface AvatarScoreEntry {
  id: string;
  displayName: string;
  color: string;
  accessory: AccessoryType;
  team: TeamId;
  isLocal: boolean;
  isBot: boolean;
  kills: number;
  deaths: number;
  points: number;
  damageDealt: number;
  roundWins: number;
  roundKills: number;
  roundPoints: number;
}

export interface RoundResultRecord {
  round: number;
  winnerLabel: string;
  winnerTeam: TeamId;
  winnerAccent: string;
  redRoundPoints: number;
  blueRoundPoints: number;
  topAvatarName: string;
  topAvatarPoints: number;
}

export interface MatchSummary {
  won: boolean;
  winnerName: string;
  placement: number;
  totalPlayers: number;
  kills: number;
  deaths: number;
  points: number;
  damageDealt: number;
  roundWins: number;
  timeSurvivedSec: number;
  mode: 'solo' | 'multi';
  gameMode: GameMode;
  totalRounds: number;
  localTeam: TeamId;
  redScore: number;
  blueScore: number;
  redRoundsWon: number;
  blueRoundsWon: number;
  mvpName: string;
  roundsHistory: RoundResultRecord[];
  avatarScores: AvatarScoreEntry[];
  roomId?: string;
  coinsEarned: number;
  xpEarned: number;
  leveledUp: boolean;
  newLevel: number;
}

export const ARENA_RADIUS = 760;
export const RESOURCE_ZONE_RADIUS = 175;
export const PLAYER_RADIUS = 19;
export const MELEE_RANGE = 94;
export const PICKUP_RANGE = 44;
export const BASE_SPEED = 205;
export const SPRINT_MULTIPLIER = 1.48;
export const SPEED_BOOST_MULTIPLIER = 1.32;
export const BASE_MELEE_DAMAGE = 12;
export const POWER_DAMAGE_MULTIPLIER = 1.35;
export const SYNC_INTERVAL_MS = 250; // 4 Hz Firestore sync
export const INTERPOLATION_LAMBDA = 11.5; // Smooth exponential decay constant
export const STALE_PLAYER_MS = 12000;
export const DEFAULT_TOTAL_ROUNDS = 4;
export const DEFAULT_ROUND_DURATION_SEC = 60; // 4 × 60s = 4:00 active play (~4m 25s with intermissions)
export const ROUND_COUNTDOWN_SEC = 2.5;
export const ROUND_INTERMISSION_SEC = 5.0;
export const TDM_RESPAWN_SEC = 3.0;
export const SURVIVAL_RESPAWN_SEC = 4.0;
export const SURVIVAL_RESURGENCE_FRAC = 0.65; // First 65% of each Survival round respawns downed players
export const STARTING_SHIELD = 25;
export const SPAWN_SHIELD_SEC = 3.0;
export const REGEN_DELAY_SEC = 4.5;
export const REGEN_HP_PER_SEC = 7;
