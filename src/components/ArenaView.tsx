import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CloudFog,
  Compass,
  Copy,
  Crosshair,
  Flame,
  Gamepad2,
  LogOut,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  ARENA_RADIUS,
  BASE_SPEED,
  COIN_REWARDS,
  MAP_ZONE_META,
  PICKUP_RANGE,
  POWER_DAMAGE_MULTIPLIER,
  RARITY_META,
  RARITY_RANK,
  REGEN_DELAY_SEC,
  REGEN_HP_PER_SEC,
  RESOURCE_ZONE_RADIUS,
  ROUND_COUNTDOWN_SEC,
  ROUND_INTERMISSION_SEC,
  SCORE_RULES,
  SPAWN_SHIELD_SEC,
  SPEED_BOOST_MULTIPLIER,
  SPRINT_MULTIPLIER,
  STALE_PLAYER_MS,
  STARTING_SHIELD,
  SURVIVAL_RESPAWN_SEC,
  SURVIVAL_RESURGENCE_FRAC,
  SYNC_INTERVAL_MS,
  TDM_RESPAWN_SEC,
  TEAM_META,
  UTILITY_SPEC,
  WEAPON_CATALOG,
  XP_REWARDS,
  applyXpGain,
  getGunUpgradeTier,
  getWeaponSpec,
  getXpForNextLevel,
  isWeaponPickup,
  type AccessoryType,
  type ActiveHazard,
  type ArenaCoin,
  type ArenaHazardData,
  type AvatarScoreEntry,
  type BeamTrail,
  type CombatHitData,
  type FighterEntity,
  type FloatingText,
  type GameMode,
  type KillFeedEntry,
  type LootRarity,
  type MapZoneId,
  type MatchSummary,
  type Obstacle,
  type Particle,
  type PickupData,
  type PlayerCustomization,
  type PlayerProgression,
  type RoomData,
  type RoomPlayerData,
  type RoundPhase,
  type RoundResultRecord,
  type SwingArc,
  type TeamId,
  type UtilityRarity,
  type WeaponCategory,
} from '../types/game';
import {
  computeZoneState,
  findTacticalCoverPoint,
  generateArenaObstacles,
  generateMidRoundSupplyDrop,
  generatePickupsForRoom,
  getCoverInfo,
  getMapZoneAt,
  getSnareSlowMultiplier,
  getSpawnPosition,
  getTeamSpawnPosition,
  hasLineOfSight,
  hasObstacleLineOfSight,
  interpolateRemoteFighter,
  isInsideSmoke,
  isProtectedByCoverFrom,
  raycastObstacleHit,
  resolveArenaCollisions,
  snapToNearestCoverBlock,
} from '../lib/arena';
import { audioEngine } from '../lib/audio';
import {
  claimRoomPickup,
  emitRoomCombatHit,
  emitRoomHazard,
  finishRoomMatch,
  startNextRoomRound,
  subscribeToRoomHazards,
  subscribeToRoomHits,
  subscribeToRoomPickups,
  syncHostZoneTick,
  syncLocalPlayerState,
} from '../lib/firebase';
import { StickFigureSvg } from './StickFigureSvg';
import { GoldCoinSvg, WeaponGraphicSvg } from './WeaponGraphicSvg';
import { MobileController } from './MobileController';

const CONCRETE_TEXTURE_URL = '/src/assets/images/arena_concrete_texture_1795067428629.jpg';

const BOT_PROFILES: { name: string; color: string; accessory: AccessoryType }[] = [
  { name: 'Dasher', color: '#3B82F6', accessory: 'headband' },
  { name: 'Vex', color: '#A855F7', accessory: 'horns' },
  { name: 'Kora', color: '#10B981', accessory: 'shades' },
  { name: 'Rex', color: '#F59E0B', accessory: 'crown' },
  { name: 'Milo', color: '#FB7185', accessory: 'mohawk' },
  { name: 'Nyx', color: '#14B8A6', accessory: 'tophat' },
  { name: 'Zed', color: '#84CC16', accessory: 'halo' },
];

interface ArenaViewProps {
  mode: 'solo' | 'multi';
  gameMode: GameMode;
  totalRounds: number;
  roundDurationSec: number;
  localUserId: string;
  localCustomization: PlayerCustomization;
  progression: PlayerProgression;
  room?: RoomData | null;
  roomPlayers?: RoomPlayerData[];
  onMatchComplete: (summary: MatchSummary) => void;
  onExitMatch: () => void;
}

interface SwapPrompt {
  pickupId: string;
  label: string;
  rarity: LootRarity;
  role: string;
}

interface ShockwaveRing {
  id: number;
  x: number;
  y: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
  strokeWidth: number;
}

interface DashGhost {
  id: number;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
}

interface JumpPad {
  id: string;
  x: number;
  y: number;
  cooldown: number;
}

interface HypeBanner {
  id: number;
  title: string;
  subtitle: string;
  accent: string;
  expiresAt: number;
}

interface HudSnapshot {
  health: number;
  shield: number;
  kills: number;
  deaths: number;
  points: number;
  localTeam: TeamId;
  localRank: number;
  aliveCount: number;
  totalCount: number;
  currentRound: number;
  totalRounds: number;
  roundPhase: RoundPhase;
  roundCountdownSec: number;
  roundTimeRemainingSec: number;
  matchTimeRemainingSec: number;
  intermissionLeftSec: number;
  totalElapsedSec: number;
  survivalResurgenceActive: boolean;
  survivalResurgenceLeftSec: number;
  redScore: number;
  blueScore: number;
  redRoundsWon: number;
  blueRoundsWon: number;
  phaseLabel: string;
  currentZone: MapZoneId;
  inStorm: boolean;
  isSnared: boolean;
  inSmoke: boolean;
  inCover: boolean;
  canSnapCover: boolean;
  speedBoostSec: number;
  damageBoostSec: number;
  spawnShieldSec: number;
  respawnTimerSec: number;
  dashReadyPct: number;
  overdrivePct: number;
  localStreak: number;
  weaponCategory: WeaponCategory;
  weaponRarity: LootRarity;
  weaponReadyPct: number;
  utilityRarity: UtilityRarity;
  utilityCharges: number;
  utilityReadyPct: number;
  hasTargetInRange: boolean;
  rareVaultRemaining: number;
  swapPrompt: SwapPrompt | null;
  isDowned: boolean;
  spectatingName: string;
  hypeBanner: HypeBanner | null;
  killFeed: KillFeedEntry[];
  lastRoundResult: RoundResultRecord | null;
  avatarScores: AvatarScoreEntry[];
  coinsEarned: number;
  totalCoins: number;
  playerLevel: number;
  playerXp: number;
  playerNextLevelXp: number;
  weaponUpgradeLevel: number;
}

function formatTimer(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

/** Build SVG annular wedge path for architectural zone sector floor inlays */
function describeSectorPath(
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number
): string {
  const s = (startDeg * Math.PI) / 180;
  const e = (endDeg * Math.PI) / 180;
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  const x1 = Math.cos(s) * outerR;
  const y1 = Math.sin(s) * outerR;
  const x2 = Math.cos(e) * outerR;
  const y2 = Math.sin(e) * outerR;
  const x3 = Math.cos(e) * innerR;
  const y3 = Math.sin(e) * innerR;
  const x4 = Math.cos(s) * innerR;
  const y4 = Math.sin(s) * innerR;
  return `M ${x1.toFixed(1)},${y1.toFixed(1)} A ${outerR},${outerR} 0 ${largeArc},1 ${x2.toFixed(
    1
  )},${y2.toFixed(1)} L ${x3.toFixed(1)},${y3.toFixed(1)} A ${innerR},${innerR} 0 ${largeArc},0 ${x4.toFixed(
    1
  )},${y4.toFixed(1)} Z`;
}

const DENSE_SECTOR_PATH = describeSectorPath(RESOURCE_ZONE_RADIUS, ARENA_RADIUS, 135, 270);
const OPEN_SECTOR_PATH = describeSectorPath(RESOURCE_ZONE_RADIUS, ARENA_RADIUS, -90, 45);
const FLANK_SECTOR_PATH = describeSectorPath(RESOURCE_ZONE_RADIUS, ARENA_RADIUS, 45, 135);

export const ArenaView: React.FC<ArenaViewProps> = ({
  mode,
  gameMode,
  totalRounds,
  roundDurationSec,
  localUserId,
  localCustomization,
  progression,
  room,
  roomPlayers = [],
  onMatchComplete,
  onExitMatch,
}) => {
  const [paused, setPaused] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [muted, setMuted] = useState(() => audioEngine.isMuted());
  const [copiedCode, setCopiedCode] = useState(false);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));
  const [mobileControlsEnabled, setMobileControlsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = window.localStorage.getItem('los_touch_pad_v1');
      if (saved === 'on') return true;
      if (saved === 'off') return false;
    } catch {
      // ignore storage errors
    }
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 900;
  });
  const [autoFireEnabled, setAutoFireEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('los_auto_fire_v1') === 'on';
    } catch {
      return false;
    }
  });

  const [, setRenderTick] = useState(0);
  const [hud, setHud] = useState<HudSnapshot>({
    health: 100,
    shield: STARTING_SHIELD,
    kills: 0,
    deaths: 0,
    points: 0,
    localTeam: gameMode === 'tdm' ? 'red' : 'none',
    localRank: 1,
    aliveCount: mode === 'solo' ? 6 : Math.max(1, roomPlayers.length),
    totalCount: mode === 'solo' ? 6 : Math.max(1, roomPlayers.length),
    currentRound: room?.currentRound ?? 1,
    totalRounds,
    roundPhase: room?.roundPhase ?? 'active',
    roundCountdownSec: ROUND_COUNTDOWN_SEC,
    roundTimeRemainingSec: roundDurationSec,
    matchTimeRemainingSec: roundDurationSec * totalRounds,
    intermissionLeftSec: 0,
    totalElapsedSec: 0,
    survivalResurgenceActive: gameMode === 'survival',
    survivalResurgenceLeftSec: Math.round(roundDurationSec * SURVIVAL_RESURGENCE_FRAC),
    redScore: room?.redScore ?? 0,
    blueScore: room?.blueScore ?? 0,
    redRoundsWon: room?.redRoundsWon ?? 0,
    blueRoundsWon: room?.blueRoundsWon ?? 0,
    phaseLabel: `R1/${totalRounds} · Safe Zone Open`,
    currentZone: 'open',
    inStorm: false,
    isSnared: false,
    inSmoke: false,
    inCover: false,
    canSnapCover: false,
    speedBoostSec: 0,
    damageBoostSec: 0,
    spawnShieldSec: SPAWN_SHIELD_SEC,
    respawnTimerSec: 0,
    dashReadyPct: 1,
    overdrivePct: 0,
    localStreak: 0,
    weaponCategory: 'close',
    weaponRarity: 'common',
    weaponReadyPct: 1,
    utilityRarity: 'none',
    utilityCharges: 0,
    utilityReadyPct: 1,
    hasTargetInRange: false,
    rareVaultRemaining: 2,
    swapPrompt: null,
    isDowned: false,
    spectatingName: '',
    hypeBanner: null,
    killFeed: [],
    lastRoundResult: null,
    avatarScores: [],
    coinsEarned: 0,
    totalCoins: progression.coins,
    playerLevel: progression.level,
    playerXp: progression.xp,
    playerNextLevelXp: getXpForNextLevel(progression.level),
    weaponUpgradeLevel: progression.gunLevels.close,
  });

  // Deterministic 4-zone arena layout
  const seedRef = useRef<number>(room?.seed ?? Math.floor(Math.random() * 900000) + 100);
  const obstaclesRef = useRef<Obstacle[]>(generateArenaObstacles(seedRef.current));

  // Simulation mutable refs
  const fightersRef = useRef<Map<string, FighterEntity>>(new Map());
  const pickupsRef = useRef<PickupData[]>([]);
  const coinsRef = useRef<ArenaCoin[]>([]);
  const hazardsRef = useRef<ActiveHazard[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const swingArcsRef = useRef<SwingArc[]>([]);
  const beamTrailsRef = useRef<BeamTrail[]>([]);
  const shockwavesRef = useRef<ShockwaveRing[]>([]);
  const ghostsRef = useRef<DashGhost[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const killFeedRef = useRef<KillFeedEntry[]>([]);
  const hypeBannerRef = useRef<HypeBanner | null>(null);

  // Progression, Coin & Live Leveling Refs
  const progressionRef = useRef<PlayerProgression>(progression);
  progressionRef.current = progression;
  const sessionCoinsRef = useRef<number>(0);
  const sessionXpRef = useRef<number>(0);
  const liveLevelRef = useRef<number>(progression.level);
  const liveXpRef = useRef<number>(progression.xp);
  const leveledUpInMatchRef = useRef<boolean>(false);
  const coinSpawnTimerRef = useRef<number>(5.0);

  // 4 Kinetic Boost / Jump Pads positioned cleanly at the 4 zone junctions
  const jumpPadsRef = useRef<JumpPad[]>(
    [
      { id: 'pad_nw', rx: -245, ry: -245 },
      { id: 'pad_ne', rx: 255, ry: -240 },
      { id: 'pad_sw', rx: -240, ry: 255 },
      { id: 'pad_se', rx: 245, ry: 245 },
    ].map((p) => {
      const clear = resolveArenaCollisions(p.rx, p.ry, obstaclesRef.current, 32);
      return { id: p.id, x: Math.round(clear.x), y: Math.round(clear.y), cooldown: 0 };
    })
  );

  // Killstreaks & Overdrive Ultimate charge
  const streaksRef = useRef<Map<string, number>>(new Map());
  const overdriveChargeRef = useRef<number>(0);

  // Multi-round phase & timing-zone refs
  const currentRoundRef = useRef<number>(room?.currentRound ?? 1);
  const roundPhaseRef = useRef<RoundPhase>(room?.roundPhase ?? 'active');
  const roundDurationRef = useRef<number>(roundDurationSec);
  const totalRoundsRef = useRef<number>(totalRounds);
  const roundCountdownRef = useRef<number>(ROUND_COUNTDOWN_SEC);
  const lastCountdownIntRef = useRef<number>(3);
  const midRoundDropSpawnedRef = useRef<boolean>(false);
  const suddenDeathAnnouncedRef = useRef<boolean>(false);
  const roundElapsedRef = useRef<number>(0);
  const intermissionLeftRef = useRef<number>(0);
  const totalElapsedRef = useRef<number>(0);

  const redScoreRef = useRef<number>(room?.redScore ?? 0);
  const blueScoreRef = useRef<number>(room?.blueScore ?? 0);
  const redRoundsWonRef = useRef<number>(room?.redRoundsWon ?? 0);
  const blueRoundsWonRef = useRef<number>(room?.blueRoundsWon ?? 0);
  const roundsHistoryRef = useRef<RoundResultRecord[]>([]);
  const lastRoundResultRef = useRef<RoundResultRecord | null>(null);
  const lastSyncedRoomRoundRef = useRef<number>(room?.currentRound ?? 1);
  const lastSyncedRoomPhaseRef = useRef<RoundPhase>(room?.roundPhase ?? 'active');

  const zoneRadiusRef = useRef<number>(room?.arenaRadius ?? ARENA_RADIUS);
  const zoneTargetRadiusRef = useRef<number>(room?.zoneTargetRadius ?? ARENA_RADIUS * 0.72);
  const zoneCenterRef = useRef<{ x: number; y: number }>({
    x: room?.zoneCenterX ?? Math.round((Math.random() - 0.5) * 90),
    y: room?.zoneCenterY ?? Math.round((Math.random() - 0.5) * 90),
  });
  const phaseLabelRef = useRef<string>(`R1/${totalRounds} · Safe Zone Open`);

  // Camera, juice, stats & input refs
  const cameraRef = useRef({ x: 0, y: 0, shake: 0 });
  const hitstopRef = useRef(0);
  const matchEndedRef = useRef(false);
  const attackSeqRef = useRef(0);
  const nextFxIdRef = useRef(1);
  const pausedRef = useRef(false);
  const stormAudioCooldownRef = useRef(0);
  const rareSparkleTimerRef = useRef(0);
  const ghostSpawnTimerRef = useRef(0);
  const regenSparkleTimerRef = useRef(0);

  // Input tracking
  const keysHeldRef = useRef<Set<string>>(new Set());
  const joyVecRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerMoveRef = useRef<{ active: boolean; worldX: number; worldY: number }>({
    active: false,
    worldX: 0,
    worldY: 0,
  });
  const justPressedAttackRef = useRef(false);
  const isHoldingAttackRef = useRef(false);
  const autoFireRef = useRef(autoFireEnabled);
  autoFireRef.current = autoFireEnabled;
  const justPressedDashRef = useRef(false);
  const justPressedUtilityRef = useRef(false);
  const justPressedSwapRef = useRef(false);
  const justPressedNovaRef = useRef(false);
  const justPressedCoverRef = useRef(false);

  // Sync timers for multiplayer
  const lastPlayerSyncRef = useRef(0);
  const lastHostZoneSyncRef = useRef(0);
  const forceSyncRef = useRef(false);
  const roomRef = useRef(room);
  roomRef.current = room;
  roundDurationRef.current = roundDurationSec;
  totalRoundsRef.current = totalRounds;
  pausedRef.current = paused;

  const areTeammates = (a: FighterEntity, b: FighterEntity): boolean =>
    gameMode === 'tdm' && a.team !== 'none' && a.team === b.team;

  const getCurrentRoundPickups = (): PickupData[] => {
    if (mode === 'solo') return pickupsRef.current;
    const prefix = `pk_r${currentRoundRef.current}_`;
    return pickupsRef.current.filter((pk) => pk.pickupId.startsWith(prefix));
  };

  const recomputeTeamTotalsFromFighters = () => {
    if (gameMode !== 'tdm') return;
    let red = 0;
    let blue = 0;
    for (const f of fightersRef.current.values()) {
      if (f.team === 'red') red += f.points;
      else if (f.team === 'blue') blue += f.points;
    }
    redScoreRef.current = Math.round(red);
    blueScoreRef.current = Math.round(blue);
  };

  const buildAvatarScoreEntries = (): AvatarScoreEntry[] => {
    return Array.from(fightersRef.current.values())
      .map((f) => ({
        id: f.id,
        displayName: f.displayName,
        color: f.color,
        accessory: f.accessory,
        team: f.team,
        isLocal: f.isLocal,
        isBot: f.isBot,
        kills: f.kills,
        deaths: f.deaths,
        points: Math.round(f.points),
        damageDealt: Math.round(f.damageDealt),
        roundWins: f.roundWins,
        roundKills: f.roundKills,
        roundPoints: Math.round(f.roundPoints),
      }))
      .sort((a, b) => b.points - a.points || b.kills - a.kills || b.damageDealt - a.damageDealt);
  };

  const computeSpawnForFighter = (
    fighterId: string,
    roundNumber: number,
    safeZone?: { x: number; y: number; radius: number }
  ): { x: number; y: number } => {
    const obstacles = obstaclesRef.current;
    const allSorted = Array.from(fightersRef.current.values()).sort((a, b) =>
      a.id.localeCompare(b.id)
    );
    const target = fightersRef.current.get(fighterId);
    if (gameMode === 'tdm' && target && (target.team === 'red' || target.team === 'blue')) {
      const teamMembers = allSorted.filter((f) => f.team === target.team);
      const slotIdx = Math.max(
        0,
        teamMembers.findIndex((f) => f.id === fighterId)
      );
      return getTeamSpawnPosition(
        target.team,
        slotIdx,
        teamMembers.length,
        obstacles,
        roundNumber,
        safeZone
      );
    }
    const idx = Math.max(
      0,
      allSorted.findIndex((f) => f.id === fighterId)
    );
    return getSpawnPosition(idx, Math.max(1, allSorted.length), obstacles, roundNumber, safeZone);
  };

  const arenaContainerRef = useRef<HTMLDivElement | null>(null);

  // Container-aware ResizeObserver + orientation auto-adjustment across phone, tablet, and laptop frames
  useEffect(() => {
    const syncFrame = (w: number, h: number) => {
      const safeW = Math.max(240, Math.round(w));
      const safeH = Math.max(240, Math.round(h));
      setViewport((prev) =>
        prev.w === safeW && prev.h === safeH ? prev : { w: safeW, h: safeH }
      );
      // Auto-toggle mobile controller on frame resize unless user explicitly set a manual preference
      try {
        const manual = window.localStorage.getItem('los_touch_pad_v1');
        if (manual !== 'on' && manual !== 'off') {
          const coarse =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(pointer: coarse)').matches;
          const shouldEnable =
            'ontouchstart' in window || navigator.maxTouchPoints > 0 || coarse || safeW <= 900;
          setMobileControlsEnabled(shouldEnable);
        }
      } catch {
        // ignore storage errors
      }
    };

    const el = arenaContainerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        syncFrame(rect.width, rect.height);
      }
    }

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && el) {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            syncFrame(width, height);
          }
        }
      });
      ro.observe(el);
    }

    const onWindowResize = () => {
      const targetEl = arenaContainerRef.current;
      if (targetEl) {
        const r = targetEl.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          syncFrame(r.width, r.height);
          return;
        }
      }
      syncFrame(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', onWindowResize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('orientationchange', onWindowResize);
    };
  }, []);

  const toggleMobileControls = () => {
    setMobileControlsEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('los_touch_pad_v1', next ? 'on' : 'off');
      } catch {
        // ignore
      }
      if (!next) {
        joyVecRef.current = { x: 0, y: 0 };
        isHoldingAttackRef.current = false;
      }
      return next;
    });
  };

  // VFX spawners
  const spawnParticles = (x: number, y: number, color: string, count = 8, speed = 135) => {
    const arr = particlesRef.current;
    for (let i = 0; i < count; i++) {
      if (arr.length > 110) arr.shift();
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.45 + Math.random() * 0.75);
      arr.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 2.5 + Math.random() * 3,
        color,
        life: 0.34 + Math.random() * 0.24,
        maxLife: 0.58,
      });
    }
  };

  const spawnFloatingText = (x: number, y: number, text: string, color: string) => {
    const arr = floatingTextsRef.current;
    if (arr.length > 18) arr.shift();
    arr.push({
      id: nextFxIdRef.current++,
      x,
      y,
      text,
      color,
      life: 0.9,
      maxLife: 0.9,
    });
  };

  const spawnSwingArc = (
    x: number,
    y: number,
    angle: number,
    color: string,
    powered: boolean,
    radius = 52
  ) => {
    const arr = swingArcsRef.current;
    if (arr.length > 12) arr.shift();
    arr.push({
      id: nextFxIdRef.current++,
      x,
      y,
      angle,
      color,
      life: 0.18,
      maxLife: 0.18,
      powered,
      radius,
    });
  };

  const spawnBeamTrail = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    kind: 'mid' | 'long'
  ) => {
    const arr = beamTrailsRef.current;
    if (arr.length > 14) arr.shift();
    arr.push({
      id: nextFxIdRef.current++,
      x1,
      y1,
      x2,
      y2,
      color,
      width: kind === 'long' ? 5.5 : 3.2,
      life: kind === 'long' ? 0.34 : 0.18,
      maxLife: kind === 'long' ? 0.34 : 0.18,
      kind,
    });
  };

  const spawnShockwave = (
    x: number,
    y: number,
    maxRadius: number,
    color: string,
    duration = 0.42,
    strokeWidth = 4
  ) => {
    const arr = shockwavesRef.current;
    if (arr.length > 16) arr.shift();
    arr.push({
      id: nextFxIdRef.current++,
      x,
      y,
      maxRadius,
      color,
      life: duration,
      maxLife: duration,
      strokeWidth,
    });
  };

  const spawnDashGhost = (x: number, y: number, color: string) => {
    const arr = ghostsRef.current;
    if (arr.length > 24) arr.shift();
    arr.push({
      id: nextFxIdRef.current++,
      x,
      y,
      color,
      life: 0.24,
      maxLife: 0.24,
    });
  };

  const triggerHypeBanner = (title: string, subtitle: string, accent: string, durationMs = 2600) => {
    hypeBannerRef.current = {
      id: nextFxIdRef.current++,
      title,
      subtitle,
      accent,
      expiresAt: performance.now() + durationMs,
    };
  };

  const pushKillFeed = (text: string, accent: string) => {
    killFeedRef.current = [
      ...killFeedRef.current.slice(-3),
      { id: nextFxIdRef.current++, text, accent, expiresAt: performance.now() + 4800 },
    ];
  };

  const getGunLevelFor = (fighter: FighterEntity): number =>
    fighter.isLocal ? progressionRef.current.gunLevels[fighter.weaponCategory] : 1;

  const grantLocalProgress = (coinsDelta: number, xpDelta: number, silent = false) => {
    if (coinsDelta > 0) {
      sessionCoinsRef.current += coinsDelta;
    }
    if (xpDelta > 0) {
      sessionXpRef.current += xpDelta;
      const res = applyXpGain(liveLevelRef.current, liveXpRef.current, xpDelta);
      liveLevelRef.current = res.level;
      liveXpRef.current = res.xp;
      if (res.leveledUp) {
        leveledUpInMatchRef.current = true;
        sessionCoinsRef.current += res.levelUpCoinBonus;
        if (!silent) {
          audioEngine.playLevelUp();
          const localF = fightersRef.current.get(localUserId);
          if (localF) {
            spawnShockwave(localF.x, localF.y, 165, '#FACC15', 0.65, 5.5);
            spawnParticles(localF.x, localF.y, '#FACC15', 22, 220);
            spawnFloatingText(localF.x, localF.y - 46, `LEVEL UP! LV.${res.level}`, '#FACC15');
          }
          triggerHypeBanner(
            `LEVEL UP! LV.${res.level}`,
            `+${res.levelUpCoinBonus} Bonus Gold Coins · Upgrade Guns in Armory!`,
            '#FACC15',
            3200
          );
          pushKillFeed(
            `Reached Level ${res.level}! (+${res.levelUpCoinBonus} Bonus Coins)`,
            '#FACC15'
          );
        }
      }
    }
  };

  const spawnCoinBurst = (
    x: number,
    y: number,
    count: number,
    valuePerCoin: number,
    kind: ArenaCoin['kind']
  ) => {
    const arr = coinsRef.current;
    for (let i = 0; i < count; i++) {
      if (arr.length >= 26) arr.shift();
      const ang = (Math.PI * 2 * i) / Math.max(1, count) + (Math.random() - 0.5) * 0.5;
      const spd = kind === 'drop' ? 110 + Math.random() * 95 : 25 + Math.random() * 45;
      const clear = resolveArenaCollisions(
        x + Math.cos(ang) * 14,
        y + Math.sin(ang) * 14,
        obstaclesRef.current,
        14
      );
      arr.push({
        id: nextFxIdRef.current++,
        x: clear.x,
        y: clear.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        value: valuePerCoin,
        kind,
        life: kind === 'drop' ? 22 : 38,
        maxLife: kind === 'drop' ? 22 : 38,
        bobPhase: Math.random() * Math.PI * 2,
      });
    }
  };

  const spawnRoundCoinCaches = () => {
    const arr: ArenaCoin[] = [];
    // 2 high-value Sundial Vault gold coins + 4 zone caches across Maze, Colonnade, Bazaar
    const spots: { x: number; y: number; value: number; kind: ArenaCoin['kind'] }[] = [
      { x: 68, y: -56, value: COIN_REWARDS.VAULT_COIN, kind: 'vault' },
      { x: -72, y: 64, value: COIN_REWARDS.VAULT_COIN, kind: 'vault' },
      { x: -335, y: -205, value: COIN_REWARDS.CACHE_COIN, kind: 'cache' },
      { x: 345, y: -195, value: COIN_REWARDS.CACHE_COIN, kind: 'cache' },
      { x: -290, y: 275, value: COIN_REWARDS.CACHE_COIN, kind: 'cache' },
      { x: 255, y: 310, value: COIN_REWARDS.CACHE_COIN, kind: 'cache' },
    ];
    for (const s of spots) {
      const clear = resolveArenaCollisions(
        s.x + (Math.random() - 0.5) * 44,
        s.y + (Math.random() - 0.5) * 44,
        obstaclesRef.current,
        16
      );
      arr.push({
        id: nextFxIdRef.current++,
        x: clear.x,
        y: clear.y,
        vx: 0,
        vy: 0,
        value: s.value,
        kind: s.kind,
        life: 55,
        maxLife: 55,
        bobPhase: Math.random() * Math.PI * 2,
      });
    }
    coinsRef.current = arr;
    coinSpawnTimerRef.current = 6.5;
  };

  const resetArenaForNewRound = (nextRound: number) => {
    const obstacles = obstaclesRef.current;
    for (const fighter of fightersRef.current.values()) {
      const shouldResetTransform = mode === 'solo' || fighter.isLocal;
      if (shouldResetTransform) {
        const spawn = computeSpawnForFighter(fighter.id, nextRound);
        fighter.x = spawn.x;
        fighter.y = spawn.y;
        fighter.targetX = spawn.x;
        fighter.targetY = spawn.y;
        fighter.facing = Math.atan2(-spawn.y, -spawn.x);
        fighter.targetFacing = fighter.facing;
      }
      fighter.vx = 0;
      fighter.vy = 0;
      fighter.knockbackVx = 0;
      fighter.knockbackVy = 0;
      fighter.health = 100;
      fighter.shield = STARTING_SHIELD;
      fighter.speedBoostSec = 0;
      fighter.damageBoostSec = 0;
      fighter.status = 'alive';
      fighter.animState = 'idle';
      fighter.attackTimer = 0;
      fighter.hitFlashTimer = 0;
      fighter.attackCooldown = fighter.isBot ? 0.55 + Math.random() * 0.4 : 0.3;
      fighter.dashCooldown = 0;
      fighter.dashTimer = 0;
      fighter.utilityCooldown = 0;
      fighter.respawnTimer = 0;
      fighter.spawnShieldTimer = SPAWN_SHIELD_SEC;
      fighter.lastDamagedAt = totalElapsedRef.current;
      fighter.lastHitBy = '';
      fighter.weaponCategory = 'close';
      fighter.weaponRarity = 'common';
      fighter.utilityRarity = 'none';
      fighter.utilityCharges = 0;
      fighter.roundKills = 0;
      fighter.roundDeaths = 0;
      fighter.roundPoints = 0;
      if (fighter.isLocal) {
        cameraRef.current.x = fighter.x;
        cameraRef.current.y = fighter.y;
      }
    }

    hazardsRef.current = [];
    swingArcsRef.current = [];
    beamTrailsRef.current = [];
    shockwavesRef.current = [];
    ghostsRef.current = [];
    for (const pad of jumpPadsRef.current) {
      pad.cooldown = 0;
    }
    roundElapsedRef.current = 0;
    roundCountdownRef.current = ROUND_COUNTDOWN_SEC;
    lastCountdownIntRef.current = 3;
    midRoundDropSpawnedRef.current = false;
    suddenDeathAnnouncedRef.current = false;
    zoneRadiusRef.current = ARENA_RADIUS;
    zoneTargetRadiusRef.current = ARENA_RADIUS * 0.72;
    zoneCenterRef.current = {
      x: Math.round((Math.random() - 0.5) * 90),
      y: Math.round((Math.random() - 0.5) * 90),
    };
    phaseLabelRef.current = `R${nextRound}/${totalRoundsRef.current} · Safe Zone Open`;

    if (mode === 'solo') {
      pickupsRef.current = generatePickupsForRoom('SOLO', seedRef.current, obstacles, nextRound).map(
        (p) => ({
          ...p,
          claimedBy: '',
        })
      );
    }
    spawnRoundCoinCaches();

    forceSyncRef.current = true;
    audioEngine.playCountdownTick(false);
    pushKillFeed(`Round ${nextRound} / ${totalRoundsRef.current} — Get Ready!`, '#F59E0B');
  };

  // Initialize fighters & round-1 pickups on mount
  useEffect(() => {
    const obstacles = obstaclesRef.current;
    const map = new Map<string, FighterEntity>();

    if (mode === 'solo') {
      const total = 6;
      const localTeam: TeamId = gameMode === 'tdm' ? 'red' : 'none';
      const localSpawn =
        gameMode === 'tdm'
          ? getTeamSpawnPosition('red', 0, 3, obstacles, 1)
          : getSpawnPosition(0, total, obstacles, 1);

      map.set(localUserId, {
        id: localUserId,
        displayName: localCustomization.displayName,
        color: localCustomization.color,
        accessory: localCustomization.accessory,
        team: localTeam,
        isLocal: true,
        isBot: false,
        x: localSpawn.x,
        y: localSpawn.y,
        targetX: localSpawn.x,
        targetY: localSpawn.y,
        vx: 0,
        vy: 0,
        facing: Math.atan2(-localSpawn.y, -localSpawn.x),
        targetFacing: Math.atan2(-localSpawn.y, -localSpawn.x),
        animState: 'idle',
        animPhase: 0,
        attackTimer: 0,
        hitFlashTimer: 0,
        dashCooldown: 0,
        dashTimer: 0,
        attackCooldown: 0,
        utilityCooldown: 0,
        respawnTimer: 0,
        spawnShieldTimer: SPAWN_SHIELD_SEC,
        knockbackVx: 0,
        knockbackVy: 0,
        health: 100,
        shield: STARTING_SHIELD,
        speedBoostSec: 0,
        damageBoostSec: 0,
        kills: 0,
        deaths: 0,
        points: 0,
        damageDealt: 0,
        roundWins: 0,
        roundKills: 0,
        roundDeaths: 0,
        roundPoints: 0,
        status: 'alive',
        lastHitBy: '',
        lastAttackSeq: 0,
        lastDamagedAt: 0,
        weaponCategory: 'close',
        weaponRarity: 'common',
        utilityRarity: 'none',
        utilityCharges: 0,
        lastSeenMs: Date.now(),
      });

      const availableBots = BOT_PROFILES.filter((b) => b.color !== localCustomization.color);
      for (let i = 1; i < total; i++) {
        const bp = availableBots[(i - 1) % availableBots.length];
        // In TDM: Local + 2 bots on Red (Crimson), 3 bots on Blue (Cobalt) = crisp 3v3!
        const botTeam: TeamId = gameMode === 'tdm' ? (i <= 2 ? 'red' : 'blue') : 'none';
        const spawn =
          gameMode === 'tdm'
            ? botTeam === 'red'
              ? getTeamSpawnPosition('red', i, 3, obstacles, 1)
              : getTeamSpawnPosition('blue', i - 3, 3, obstacles, 1)
            : getSpawnPosition(i, total, obstacles, 1);

        map.set(`bot_${i}`, {
          id: `bot_${i}`,
          displayName: bp.name,
          color: bp.color,
          accessory: bp.accessory,
          team: botTeam,
          isLocal: false,
          isBot: true,
          x: spawn.x,
          y: spawn.y,
          targetX: spawn.x,
          targetY: spawn.y,
          vx: 0,
          vy: 0,
          facing: Math.atan2(-spawn.y, -spawn.x),
          targetFacing: Math.atan2(-spawn.y, -spawn.x),
          animState: 'idle',
          animPhase: Math.random() * 6,
          attackTimer: 0,
          hitFlashTimer: 0,
          dashCooldown: 0,
          dashTimer: 0,
          attackCooldown: 0.6 + Math.random() * 0.5,
          utilityCooldown: 0,
          respawnTimer: 0,
          spawnShieldTimer: SPAWN_SHIELD_SEC,
          knockbackVx: 0,
          knockbackVy: 0,
          health: 100,
          shield: STARTING_SHIELD,
          speedBoostSec: 0,
          damageBoostSec: 0,
          kills: 0,
          deaths: 0,
          points: 0,
          damageDealt: 0,
          roundWins: 0,
          roundKills: 0,
          roundDeaths: 0,
          roundPoints: 0,
          status: 'alive',
          lastHitBy: '',
          lastAttackSeq: 0,
          lastDamagedAt: 0,
          weaponCategory: 'close',
          weaponRarity: 'common',
          utilityRarity: 'none',
          utilityCharges: 0,
          lastSeenMs: Date.now(),
          botGoalX: 0,
          botGoalY: 0,
          botDecisionTimer: 0.25 + Math.random() * 0.55,
          botBoldness: 0.25 + (i / total) * 0.65,
        });
      }

      fightersRef.current = map;
      cameraRef.current.x = localSpawn.x;
      cameraRef.current.y = localSpawn.y;
      pickupsRef.current = generatePickupsForRoom('SOLO', seedRef.current, obstacles, 1).map((p) => ({
        ...p,
        claimedBy: '',
      }));
      spawnRoundCoinCaches();
      audioEngine.playCountdownTick(false);
    } else if (room) {
      const sorted = [...roomPlayers].sort((a, b) => a.playerId.localeCompare(b.playerId));
      const total = Math.max(1, sorted.length);
      const redIds: string[] = [];
      const blueIds: string[] = [];

      const resolvedTeams = new Map<string, TeamId>();
      sorted.forEach((p, idx) => {
        const team: TeamId =
          gameMode === 'survival'
            ? 'none'
            : p.team === 'red' || p.team === 'blue'
              ? p.team
              : idx % 2 === 0
                ? 'red'
                : 'blue';
        resolvedTeams.set(p.playerId, team);
        if (team === 'red') redIds.push(p.playerId);
        else if (team === 'blue') blueIds.push(p.playerId);
      });

      sorted.forEach((p, idx) => {
        const isLocal = p.playerId === localUserId;
        const team = resolvedTeams.get(p.playerId) ?? 'none';
        const spawn =
          gameMode === 'tdm' && (team === 'red' || team === 'blue')
            ? getTeamSpawnPosition(
                team,
                team === 'red' ? redIds.indexOf(p.playerId) : blueIds.indexOf(p.playerId),
                team === 'red' ? redIds.length : blueIds.length,
                obstacles,
                room.currentRound
              )
            : getSpawnPosition(idx, total, obstacles, room.currentRound);
        const startX = isLocal ? spawn.x : p.x || spawn.x;
        const startY = isLocal ? spawn.y : p.y || spawn.y;

        map.set(p.playerId, {
          id: p.playerId,
          displayName: p.displayName,
          color: p.color,
          accessory: p.accessory,
          team,
          isLocal,
          isBot: false,
          x: startX,
          y: startY,
          targetX: startX,
          targetY: startY,
          vx: p.vx || 0,
          vy: p.vy || 0,
          facing: p.facing || 0,
          targetFacing: p.facing || 0,
          animState: isLocal ? 'idle' : p.animState,
          animPhase: 0,
          attackTimer: 0,
          hitFlashTimer: 0,
          dashCooldown: 0,
          dashTimer: 0,
          attackCooldown: 0,
          utilityCooldown: 0,
          respawnTimer: 0,
          spawnShieldTimer: SPAWN_SHIELD_SEC,
          knockbackVx: 0,
          knockbackVy: 0,
          health: isLocal ? 100 : p.health,
          shield: isLocal ? STARTING_SHIELD : p.shield,
          speedBoostSec: isLocal ? 0 : p.speedBoostSec,
          damageBoostSec: isLocal ? 0 : p.damageBoostSec,
          kills: p.kills || 0,
          deaths: p.deaths || 0,
          points: p.points || 0,
          damageDealt: p.damageDealt || 0,
          roundWins: p.roundWins || 0,
          roundKills: 0,
          roundDeaths: 0,
          roundPoints: 0,
          status: isLocal ? 'alive' : p.status,
          lastHitBy: '',
          lastAttackSeq: p.lastAttackSeq || 0,
          lastDamagedAt: 0,
          weaponCategory: isLocal ? 'close' : p.weaponCategory || 'close',
          weaponRarity: isLocal ? 'common' : p.weaponRarity || 'common',
          utilityRarity: isLocal ? 'none' : p.utilityRarity || 'none',
          utilityCharges: isLocal ? 0 : p.utilityCharges || 0,
          lastSeenMs: p.updatedAtMs ?? Date.now(),
        });

        if (isLocal) {
          cameraRef.current.x = startX;
          cameraRef.current.y = startY;
          forceSyncRef.current = true;
        }
      });

      fightersRef.current = map;
      spawnRoundCoinCaches();
      audioEngine.playCountdownTick(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Multiplayer: ingest incoming Firestore player snapshots into network targets & per-avatar scores
  useEffect(() => {
    if (mode !== 'multi' || !room) return;
    const map = fightersRef.current;

    for (const rp of roomPlayers) {
      if (rp.playerId === localUserId) continue;

      const existing = map.get(rp.playerId);
      const resolvedTeam: TeamId =
        gameMode === 'survival'
          ? 'none'
          : rp.team === 'red' || rp.team === 'blue'
            ? rp.team
            : 'blue';

      if (!existing) {
        map.set(rp.playerId, {
          id: rp.playerId,
          displayName: rp.displayName,
          color: rp.color,
          accessory: rp.accessory,
          team: resolvedTeam,
          isLocal: false,
          isBot: false,
          x: rp.x,
          y: rp.y,
          targetX: rp.x,
          targetY: rp.y,
          vx: rp.vx,
          vy: rp.vy,
          facing: rp.facing,
          targetFacing: rp.facing,
          animState: rp.animState,
          animPhase: 0,
          attackTimer: 0,
          hitFlashTimer: 0,
          dashCooldown: 0,
          dashTimer: 0,
          attackCooldown: 0,
          utilityCooldown: 0,
          respawnTimer: 0,
          spawnShieldTimer: 0,
          knockbackVx: 0,
          knockbackVy: 0,
          health: rp.health,
          shield: rp.shield,
          speedBoostSec: rp.speedBoostSec,
          damageBoostSec: rp.damageBoostSec,
          kills: rp.kills,
          deaths: rp.deaths,
          points: rp.points,
          damageDealt: rp.damageDealt,
          roundWins: rp.roundWins,
          roundKills: 0,
          roundDeaths: 0,
          roundPoints: 0,
          status: rp.status,
          lastHitBy: rp.lastHitBy,
          lastAttackSeq: rp.lastAttackSeq,
          lastDamagedAt: 0,
          weaponCategory: rp.weaponCategory || 'close',
          weaponRarity: rp.weaponRarity || 'common',
          utilityRarity: rp.utilityRarity || 'none',
          utilityCharges: rp.utilityCharges || 0,
          lastSeenMs: rp.updatedAtMs ?? Date.now(),
        });
      } else {
        if (rp.lastAttackSeq > existing.lastAttackSeq) {
          existing.lastAttackSeq = rp.lastAttackSeq;
          existing.attackTimer = 0.22;
          existing.animState = 'attack';
          const spec = getWeaponSpec(rp.weaponCategory || 'close', rp.weaponRarity || 'common');
          const accent = RARITY_META[rp.weaponRarity || 'common'].color;
          if (spec.category === 'close') {
            spawnSwingArc(
              existing.x,
              existing.y,
              rp.facing,
              accent,
              rp.damageBoostSec > 0,
              spec.range * 0.56
            );
          } else {
            const reach = spec.range * 0.85;
            const rawEndX = existing.x + Math.cos(rp.facing) * reach;
            const rawEndY = existing.y + Math.sin(rp.facing) * reach;
            const blockHit = raycastObstacleHit(
              existing.x,
              existing.y,
              rawEndX,
              rawEndY,
              obstaclesRef.current
            );
            spawnBeamTrail(
              existing.x,
              existing.y,
              blockHit ? blockHit.x : rawEndX,
              blockHit ? blockHit.y : rawEndY,
              accent,
              spec.category
            );
            if (blockHit) {
              spawnParticles(blockHit.x, blockHit.y, '#CBD5E1', 6, 110);
            }
          }
        }

        const remoteJustDied =
          (existing.status === 'alive' && rp.status === 'downed') || rp.deaths > existing.deaths;
        if (remoteJustDied) {
          streaksRef.current.set(rp.playerId, 0);
          audioEngine.playElimination();
          spawnParticles(existing.x, existing.y, existing.color, 16, 180);
          spawnShockwave(existing.x, existing.y, 72, existing.color, 0.38, 3.5);
          const killer = rp.lastHitBy ? map.get(rp.lastHitBy) : null;
          if (rp.lastHitBy === localUserId) {
            const localF = map.get(localUserId);
            if (localF) {
              localF.kills += 1;
              localF.roundKills += 1;
              localF.points += SCORE_RULES.KILL;
              localF.roundPoints += SCORE_RULES.KILL;
              overdriveChargeRef.current = Math.min(100, overdriveChargeRef.current + 28);
              const nextStreak = (streaksRef.current.get(localUserId) ?? 0) + 1;
              streaksRef.current.set(localUserId, nextStreak);
              if (nextStreak >= 2) {
                const bonus = nextStreak >= 5 ? 200 : nextStreak === 4 ? 150 : nextStreak === 3 ? 100 : 50;
                const label =
                  nextStreak >= 5
                    ? 'GODLIKE!'
                    : nextStreak === 4
                      ? 'UNSTOPPABLE!'
                      : nextStreak === 3
                        ? 'TRIPLE KO!'
                        : 'DOUBLE KO!';
                localF.points += bonus;
                localF.roundPoints += bonus;
                audioEngine.playKillstreak(nextStreak);
                triggerHypeBanner(label, `${localF.displayName} · +${bonus} STREAK BONUS`, '#FACC15');
              }
              spawnFloatingText(localF.x, localF.y - 34, `+${SCORE_RULES.KILL} PTS`, '#FACC15');
              spawnCoinBurst(existing.x, existing.y, 3, COIN_REWARDS.DROP_COIN, 'drop');
              grantLocalProgress(0, XP_REWARDS.KILL);
              forceSyncRef.current = true;
            }
          }
          pushKillFeed(
            killer
              ? `${killer.displayName} knocked out ${rp.displayName}`
              : `${rp.displayName} fell to the storm`,
            killer ? killer.color : '#EF4444'
          );
        }

        if (rp.health < existing.health) {
          existing.hitFlashTimer = 0.16;
          spawnParticles(existing.x, existing.y, '#FFFFFF', 6, 120);
        }

        const deltaPts = Math.max(0, rp.points - existing.points);
        const deltaKills = Math.max(0, rp.kills - existing.kills);
        const deltaDeaths = Math.max(0, rp.deaths - existing.deaths);

        existing.displayName = rp.displayName;
        existing.color = rp.color;
        existing.accessory = rp.accessory;
        existing.team = resolvedTeam;
        existing.targetX = rp.x;
        existing.targetY = rp.y;
        existing.vx = rp.vx;
        existing.vy = rp.vy;
        existing.targetFacing = rp.facing;
        existing.health = rp.health;
        existing.shield = rp.shield;
        existing.speedBoostSec = rp.speedBoostSec;
        existing.damageBoostSec = rp.damageBoostSec;
        existing.kills = rp.kills;
        existing.deaths = rp.deaths;
        existing.points = rp.points;
        existing.damageDealt = rp.damageDealt;
        existing.roundWins = rp.roundWins;
        existing.roundPoints += deltaPts;
        existing.roundKills += deltaKills;
        existing.roundDeaths += deltaDeaths;
        existing.status = rp.status;
        existing.lastHitBy = rp.lastHitBy;
        existing.weaponCategory = rp.weaponCategory || 'close';
        existing.weaponRarity = rp.weaponRarity || 'common';
        existing.utilityRarity = rp.utilityRarity || 'none';
        existing.utilityCharges = rp.utilityCharges || 0;
        existing.lastSeenMs = rp.updatedAtMs ?? Date.now();
      }
    }
    recomputeTeamTotalsFromFighters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gameMode, room, roomPlayers, localUserId]);

  // Multiplayer: observe host-driven round transitions on non-host clients
  useEffect(() => {
    if (mode !== 'multi' || !room) return;
    const isHost = room.hostId === localUserId;
    if (isHost) return;

    redScoreRef.current = room.redScore;
    blueScoreRef.current = room.blueScore;
    redRoundsWonRef.current = room.redRoundsWon;
    blueRoundsWonRef.current = room.blueRoundsWon;

    if (room.roundPhase === 'intermission' && lastSyncedRoomPhaseRef.current !== 'intermission') {
      roundPhaseRef.current = 'intermission';
      intermissionLeftRef.current = ROUND_INTERMISSION_SEC;
      audioEngine.playRoundEnd();

      // Snapshot round record for non-host intermission overlay
      const entries = buildAvatarScoreEntries();
      const topRound = [...entries].sort((a, b) => b.roundPoints - a.roundPoints)[0];
      const redRoundPts = entries
        .filter((e) => e.team === 'red')
        .reduce((acc, e) => acc + e.roundPoints, 0);
      const blueRoundPts = entries
        .filter((e) => e.team === 'blue')
        .reduce((acc, e) => acc + e.roundPoints, 0);

      let winnerTeam: TeamId = 'none';
      let winnerLabel = topRound ? topRound.displayName : 'Round Complete';
      let winnerAccent = topRound ? topRound.color : '#F59E0B';
      if (gameMode === 'tdm') {
        if (redRoundPts > blueRoundPts) {
          winnerTeam = 'red';
          winnerLabel = TEAM_META.red.name;
          winnerAccent = TEAM_META.red.color;
        } else if (blueRoundPts > redRoundPts) {
          winnerTeam = 'blue';
          winnerLabel = TEAM_META.blue.name;
          winnerAccent = TEAM_META.blue.color;
        } else {
          winnerLabel = 'Round Tied';
          winnerAccent = '#94A3B8';
        }
      }

      // Award local round-win bonus on non-host client if local won
      const localF = fightersRef.current.get(localUserId);
      if (localF) {
        const localWonRound =
          gameMode === 'tdm'
            ? winnerTeam !== 'none' && localF.team === winnerTeam
            : topRound?.id === localUserId;
        if (localWonRound) {
          localF.roundWins += 1;
          localF.points += SCORE_RULES.ROUND_WIN;
          localF.roundPoints += SCORE_RULES.ROUND_WIN;
          forceSyncRef.current = true;
        }
      }

      const record: RoundResultRecord = {
        round: room.currentRound,
        winnerLabel,
        winnerTeam,
        winnerAccent,
        redRoundPoints: redRoundPts,
        blueRoundPoints: blueRoundPts,
        topAvatarName: topRound?.displayName ?? 'Fighter',
        topAvatarPoints: topRound?.roundPoints ?? 0,
      };
      roundsHistoryRef.current = [
        ...roundsHistoryRef.current.filter((r) => r.round !== room.currentRound),
        record,
      ];
      lastRoundResultRef.current = record;
    }

    if (room.currentRound > lastSyncedRoomRoundRef.current) {
      currentRoundRef.current = room.currentRound;
      roundPhaseRef.current = 'active';
      resetArenaForNewRound(room.currentRound);
    }

    lastSyncedRoomRoundRef.current = room.currentRound;
    lastSyncedRoomPhaseRef.current = room.roundPhase;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    gameMode,
    room?.currentRound,
    room?.roundPhase,
    room?.redScore,
    room?.blueScore,
    room?.redRoundsWon,
    room?.blueRoundsWon,
    localUserId,
  ]);

  // Multiplayer: subscribe to pickups, combat hits & area utility hazards
  useEffect(() => {
    if (mode !== 'multi' || !room) return;
    const unsubPickups = subscribeToRoomPickups(room.roomId, (list) => {
      pickupsRef.current = list;
    });

    const unsubHits = subscribeToRoomHits(room.roomId, (hit: CombatHitData) => {
      if (roundPhaseRef.current !== 'active') return;
      const local = fightersRef.current.get(localUserId);
      const target = fightersRef.current.get(hit.targetId);
      const attacker = fightersRef.current.get(hit.attackerId);
      if (attacker && target && areTeammates(attacker, target)) return;

      if (target) {
        spawnParticles(target.x, target.y, '#F8FAFC', 9, 150);
        spawnFloatingText(target.x, target.y - 26, `-${hit.damage}`, '#FB7185');
        if (attacker && attacker.weaponCategory !== 'close') {
          spawnBeamTrail(
            attacker.x,
            attacker.y,
            target.x,
            target.y,
            RARITY_META[attacker.weaponRarity].color,
            attacker.weaponCategory
          );
        }
      }

      if (
        local &&
        hit.targetId === localUserId &&
        local.status === 'alive' &&
        local.spawnShieldTimer <= 0
      ) {
        const attackerSpec = attacker
          ? getWeaponSpec(attacker.weaponCategory, attacker.weaponRarity)
          : getWeaponSpec('long', 'rare');
        const dist = attacker ? Math.hypot(attacker.x - local.x, attacker.y - local.y) : 0;
        const maxValidRange = Math.max(attackerSpec.range * 1.65, 240);
        if (!attacker || dist <= maxValidRange) {
          const localCover = getCoverInfo(local.x, local.y, obstaclesRef.current, 24);
          const coverProtected =
            attacker !== undefined &&
            isProtectedByCoverFrom(local.x, local.y, attacker.x, attacker.y, localCover);
          const incomingDmg = coverProtected ? Math.max(1, Math.round(hit.damage * 0.65)) : hit.damage;
          const kbScale = coverProtected ? 0.65 : 1;

          let remaining = incomingDmg;
          if (local.shield > 0) {
            const absorbed = Math.min(local.shield, remaining);
            local.shield -= absorbed;
            remaining -= absorbed;
          }
          local.health = Math.max(0, local.health - remaining);
          local.lastHitBy = hit.attackerId;
          local.lastDamagedAt = totalElapsedRef.current;
          local.hitFlashTimer = 0.2;
          local.animState = 'hit';
          local.knockbackVx += hit.knockbackX * kbScale;
          local.knockbackVy += hit.knockbackY * kbScale;
          cameraRef.current.shake = Math.min(14, cameraRef.current.shake + (coverProtected ? 4.5 : 8));
          hitstopRef.current = coverProtected ? 0.025 : 0.04;
          if (coverProtected) {
            audioEngine.playCoverBlock();
            spawnParticles(local.x, local.y, '#10B981', 8, 125);
            spawnFloatingText(local.x, local.y - 40, 'COVER -35%', '#10B981');
          } else {
            audioEngine.playHit(incomingDmg >= 25);
          }

          if (local.health <= 0) {
            local.status = 'downed';
            local.animState = 'downed';
            local.deaths += 1;
            local.roundDeaths += 1;
            streaksRef.current.set(local.id, 0);
            const resurgenceActive =
              gameMode === 'survival' &&
              roundElapsedRef.current < roundDurationRef.current * SURVIVAL_RESURGENCE_FRAC;
            if (gameMode === 'tdm') {
              local.respawnTimer = TDM_RESPAWN_SEC;
            } else if (resurgenceActive) {
              local.respawnTimer = SURVIVAL_RESPAWN_SEC;
            }
            audioEngine.playElimination();
            spawnParticles(local.x, local.y, local.color, 18, 190);
            spawnShockwave(local.x, local.y, 76, '#EF4444', 0.4, 4);
            pushKillFeed(
              attacker ? `${attacker.displayName} knocked you out` : 'You were knocked out',
              '#EF4444'
            );
          }
          forceSyncRef.current = true;
        }
      }
    });

    const unsubHazards = subscribeToRoomHazards(room.roomId, (hz: ArenaHazardData) => {
      if (hz.ownerId === localUserId) return;
      const spec = UTILITY_SPEC[hz.rarity];
      const owner = fightersRef.current.get(hz.ownerId);
      hazardsRef.current.push({
        id: hz.hazardId,
        ownerId: hz.ownerId,
        ownerTeam: owner?.team ?? 'none',
        rarity: hz.rarity,
        x: hz.x,
        y: hz.y,
        radius: hz.radius,
        life: hz.durationSec,
        maxLife: hz.durationSec,
        slowFactor: spec.slowFactor,
      });
      audioEngine.playUtilityDeploy(hz.rarity === 'rare');
      spawnParticles(hz.x, hz.y, hz.rarity === 'rare' ? '#FACC15' : '#94A3B8', 14, 140);
    });

    return () => {
      unsubPickups();
      unsubHits();
      unsubHazards();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gameMode, room, localUserId]);

  // Multiplayer: watch room status transition to 'ended'
  useEffect(() => {
    if (mode !== 'multi' || !room || matchEndedRef.current) return;
    if (room.status === 'ended') {
      matchEndedRef.current = true;
      const avatarScores = buildAvatarScoreEntries();
      const local = fightersRef.current.get(localUserId);
      const localRank = Math.max(
        1,
        avatarScores.findIndex((a) => a.id === localUserId) + 1
      );
      const mvp = avatarScores[0];

      const won =
        gameMode === 'tdm'
          ? room.winnerId === `team_${local?.team ?? 'none'}` ||
            (local?.team === 'red' && room.redScore > room.blueScore) ||
            (local?.team === 'blue' && room.blueScore > room.redScore)
          : room.winnerId === localUserId;

      if (won) audioEngine.playVictory();
      grantLocalProgress(
        COIN_REWARDS.MATCH_COMPLETE + (won ? COIN_REWARDS.MATCH_VICTORY : 0),
        XP_REWARDS.MATCH_COMPLETE + (won ? XP_REWARDS.MATCH_VICTORY : 0),
        true
      );

      onMatchComplete({
        won,
        winnerName: room.winnerName || (won ? localCustomization.displayName : 'Champion'),
        placement: localRank,
        totalPlayers: Math.max(1, avatarScores.length),
        kills: local?.kills ?? 0,
        deaths: local?.deaths ?? 0,
        points: Math.round(local?.points ?? 0),
        damageDealt: Math.round(local?.damageDealt ?? 0),
        roundWins: local?.roundWins ?? 0,
        timeSurvivedSec: Math.round(totalElapsedRef.current),
        mode: 'multi',
        gameMode,
        totalRounds: room.totalRounds,
        localTeam: local?.team ?? 'none',
        redScore: room.redScore,
        blueScore: room.blueScore,
        redRoundsWon: room.redRoundsWon,
        blueRoundsWon: room.blueRoundsWon,
        mvpName: mvp?.displayName ?? localCustomization.displayName,
        roundsHistory: [...roundsHistoryRef.current],
        avatarScores,
        roomId: room.roomId,
        coinsEarned: sessionCoinsRef.current,
        xpEarned: sessionXpRef.current,
        leveledUp: leveledUpInMatchRef.current,
        newLevel: liveLevelRef.current,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gameMode, room, localUserId, localCustomization.displayName, onMatchComplete]);

  // Keyboard listeners + Tab live scoreboard + window blur reset
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (scoreboardOpen) {
          setScoreboardOpen(false);
        } else {
          setPaused((p) => !p);
        }
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setScoreboardOpen(true);
        return;
      }
      if (pausedRef.current) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'j' || k === 'enter') {
        e.preventDefault();
        if (!e.repeat) justPressedAttackRef.current = true;
        return;
      }
      if (k === 'shift' || k === 'k') {
        if (!e.repeat) justPressedDashRef.current = true;
      }
      if (k === 'q' || k === 'f') {
        if (!e.repeat) justPressedUtilityRef.current = true;
        return;
      }
      if (k === 'e') {
        if (!e.repeat) justPressedSwapRef.current = true;
        return;
      }
      if (k === 'r') {
        if (!e.repeat) justPressedNovaRef.current = true;
        return;
      }
      if (k === 'c') {
        if (!e.repeat) justPressedCoverRef.current = true;
        return;
      }
      keysHeldRef.current.add(k);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setScoreboardOpen(false);
        return;
      }
      keysHeldRef.current.delete(e.key.toLowerCase());
    };

    const onBlur = () => {
      keysHeldRef.current.clear();
      pointerMoveRef.current.active = false;
      joyVecRef.current = { x: 0, y: 0 };
      isHoldingAttackRef.current = false;
      setScoreboardOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [scoreboardOpen]);

  // Main 60fps simulation loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let hudTimer = 0;

    const addDamageScore = (attacker: FighterEntity, dmg: number) => {
      const prevBucket = Math.floor(attacker.damageDealt / SCORE_RULES.DAMAGE_DIVISOR);
      attacker.damageDealt += dmg;
      const nextBucket = Math.floor(attacker.damageDealt / SCORE_RULES.DAMAGE_DIVISOR);
      const pts = nextBucket - prevBucket;
      if (pts > 0) {
        attacker.points += pts;
        attacker.roundPoints += pts;
        recomputeTeamTotalsFromFighters();
      }
    };

    const applyPickupEffect = (fighter: FighterEntity, pickup: PickupData) => {
      const rarityColor = RARITY_META[pickup.rarity].color;

      if (pickup.type === 'medkit') {
        const heal = pickup.rarity === 'uncommon' ? 45 : 32;
        fighter.health = Math.min(100, fighter.health + heal);
        if (fighter.isLocal) spawnFloatingText(fighter.x, fighter.y - 30, `+${heal} HP`, '#10B981');
      } else if (pickup.type === 'shield') {
        const amt = pickup.rarity === 'uncommon' ? 45 : 30;
        fighter.shield = Math.min(50, fighter.shield + amt);
        if (fighter.isLocal) spawnFloatingText(fighter.x, fighter.y - 30, `+${amt} SHIELD`, '#38BDF8');
      } else if (pickup.type === 'speed') {
        fighter.speedBoostSec = pickup.rarity === 'uncommon' ? 9 : 7;
        if (fighter.isLocal) spawnFloatingText(fighter.x, fighter.y - 30, 'SPEED BOOST', '#F59E0B');
      } else if (pickup.type === 'power') {
        fighter.damageBoostSec = pickup.rarity === 'uncommon' ? 9 : 7;
        if (fighter.isLocal) spawnFloatingText(fighter.x, fighter.y - 30, 'POWER SURGE', '#F97316');
      } else if (pickup.type === 'utility') {
        const uRarity: 'uncommon' | 'rare' = pickup.rarity === 'rare' ? 'rare' : 'uncommon';
        const spec = UTILITY_SPEC[uRarity];
        if (fighter.utilityRarity !== 'rare' || uRarity === 'rare') {
          fighter.utilityRarity = uRarity;
        }
        fighter.utilityCharges = Math.min(5, fighter.utilityCharges + spec.chargesOnPickup);
        if (fighter.isLocal) {
          spawnFloatingText(
            fighter.x,
            fighter.y - 32,
            `${RARITY_META[uRarity].label.toUpperCase()} SHROUD x${spec.chargesOnPickup}`,
            RARITY_META[uRarity].color
          );
        }
        if (uRarity === 'rare') {
          pushKillFeed(
            `${fighter.displayName} claimed Rare Shroud Snare (+${SCORE_RULES.RARE_CLAIM} pts)!`,
            '#FACC15'
          );
        }
      } else if (isWeaponPickup(pickup.type)) {
        fighter.weaponCategory = pickup.type;
        fighter.weaponRarity = pickup.rarity;
        const spec = getWeaponSpec(pickup.type, pickup.rarity);
        if (fighter.isLocal) {
          spawnFloatingText(
            fighter.x,
            fighter.y - 32,
            `${RARITY_META[pickup.rarity].label.toUpperCase()} ${spec.name.toUpperCase()}`,
            rarityColor
          );
        }
        if (pickup.rarity === 'rare') {
          pushKillFeed(
            `${fighter.displayName} claimed Rare ${spec.name} (+${SCORE_RULES.RARE_CLAIM} pts)!`,
            '#FACC15'
          );
        }
      }

      // Rare Gold Vault Claim Bonus (+50 pts for the claiming avatar & team!)
      if (pickup.rarity === 'rare') {
        fighter.points += SCORE_RULES.RARE_CLAIM;
        fighter.roundPoints += SCORE_RULES.RARE_CLAIM;
        recomputeTeamTotalsFromFighters();
        spawnShockwave(pickup.x, pickup.y, 110, '#FACC15', 0.5, 4.5);
        if (fighter.isLocal) {
          overdriveChargeRef.current = Math.min(100, overdriveChargeRef.current + 25);
          spawnFloatingText(fighter.x, fighter.y - 48, `+${SCORE_RULES.RARE_CLAIM} VAULT PTS`, '#FACC15');
          spawnCoinBurst(pickup.x, pickup.y, 2, COIN_REWARDS.CACHE_COIN, 'drop');
          grantLocalProgress(0, XP_REWARDS.RARE_CLAIM);
        }
      }

      spawnParticles(
        pickup.x,
        pickup.y,
        pickup.rarity === 'rare'
          ? '#FACC15'
          : isWeaponPickup(pickup.type) || pickup.type === 'utility'
            ? rarityColor
            : pickup.type === 'medkit'
              ? '#10B981'
              : pickup.type === 'shield'
                ? '#38BDF8'
                : pickup.type === 'speed'
                  ? '#F59E0B'
                  : '#F97316',
        pickup.rarity === 'rare' ? 18 : 10,
        pickup.rarity === 'rare' ? 170 : 130
      );

      if (fighter.isLocal) {
        audioEngine.playPickup(pickup.type, pickup.rarity);
        forceSyncRef.current = true;
      }
    };

    const deployUtility = (fighter: FighterEntity) => {
      if (
        fighter.status !== 'alive' ||
        fighter.utilityCharges <= 0 ||
        fighter.utilityRarity === 'none' ||
        fighter.utilityCooldown > 0
      ) {
        return;
      }

      const uRarity = fighter.utilityRarity;
      const spec = UTILITY_SPEC[uRarity];
      fighter.utilityCharges = Math.max(0, fighter.utilityCharges - 1);
      fighter.utilityCooldown = spec.cooldownSec;
      if (fighter.utilityCharges === 0) {
        fighter.utilityRarity = 'none';
      }

      const rawX = fighter.x + Math.cos(fighter.facing) * 76;
      const rawY = fighter.y + Math.sin(fighter.facing) * 76;
      const clamped = resolveArenaCollisions(rawX, rawY, [], 18);

      hazardsRef.current.push({
        id: `hz_local_${nextFxIdRef.current++}`,
        ownerId: fighter.id,
        ownerTeam: fighter.team,
        rarity: uRarity,
        x: clamped.x,
        y: clamped.y,
        radius: spec.radius,
        life: spec.durationSec,
        maxLife: spec.durationSec,
        slowFactor: spec.slowFactor,
      });

      spawnParticles(clamped.x, clamped.y, uRarity === 'rare' ? '#FACC15' : '#94A3B8', 16, 150);
      if (fighter.isLocal) {
        audioEngine.playUtilityDeploy(uRarity === 'rare');
        spawnFloatingText(
          clamped.x,
          clamped.y - 24,
          'SHROUD SNARE',
          uRarity === 'rare' ? '#FACC15' : '#C084FC'
        );
        forceSyncRef.current = true;
        if (mode === 'multi' && roomRef.current) {
          void emitRoomHazard(
            roomRef.current.roomId,
            fighter.id,
            uRarity,
            clamped.x,
            clamped.y,
            spec.radius,
            spec.durationSec
          );
        }
      }
    };

    const findBestTargetFor = (attacker: FighterEntity): FighterEntity | null => {
      const spec = getWeaponSpec(attacker.weaponCategory, attacker.weaponRarity, getGunLevelFor(attacker));
      let closestTarget: FighterEntity | null = null;
      let closestDist = spec.range + 8;

      for (const other of fightersRef.current.values()) {
        if (other.id === attacker.id || other.status !== 'alive') continue;
        if (areTeammates(attacker, other)) continue;
        if (other.spawnShieldTimer > 0) continue;
        const d = Math.hypot(other.x - attacker.x, other.y - attacker.y);
        if (d >= closestDist) continue;
        // Solid arena blocks ALWAYS protect against attacks (even close-range cannot strike through walls/crates)
        if (!hasObstacleLineOfSight(attacker.x, attacker.y, other.x, other.y, obstaclesRef.current)) {
          continue;
        }
        if (
          spec.requiresLos &&
          !hasLineOfSight(
            attacker.x,
            attacker.y,
            other.x,
            other.y,
            obstaclesRef.current,
            hazardsRef.current
          )
        ) {
          continue;
        }
        closestDist = d;
        closestTarget = other;
      }
      return closestTarget;
    };

    const recordElimination = (
      attacker: FighterEntity,
      victim: FighterEntity,
      weaponLabel: string
    ) => {
      victim.status = 'downed';
      victim.animState = 'downed';
      victim.deaths += 1;
      victim.roundDeaths += 1;
      streaksRef.current.set(victim.id, 0);

      const resurgenceActive =
        gameMode === 'survival' &&
        roundElapsedRef.current < roundDurationRef.current * SURVIVAL_RESURGENCE_FRAC;
      if (gameMode === 'tdm') {
        victim.respawnTimer = TDM_RESPAWN_SEC;
      } else if (resurgenceActive) {
        victim.respawnTimer = SURVIVAL_RESPAWN_SEC;
      }

      attacker.kills += 1;
      attacker.roundKills += 1;
      attacker.points += SCORE_RULES.KILL;
      attacker.roundPoints += SCORE_RULES.KILL;

      const nextStreak = (streaksRef.current.get(attacker.id) ?? 0) + 1;
      streaksRef.current.set(attacker.id, nextStreak);
      let streakTag = '';
      if (nextStreak >= 2) {
        const bonus = nextStreak >= 5 ? 200 : nextStreak === 4 ? 150 : nextStreak === 3 ? 100 : 50;
        const label =
          nextStreak >= 5
            ? 'GODLIKE!'
            : nextStreak === 4
              ? 'UNSTOPPABLE!'
              : nextStreak === 3
                ? 'TRIPLE KO!'
                : 'DOUBLE KO!';
        attacker.points += bonus;
        attacker.roundPoints += bonus;
        streakTag = ` · ${label}`;
        if (attacker.isLocal || nextStreak >= 3) {
          audioEngine.playKillstreak(nextStreak);
          spawnShockwave(attacker.x, attacker.y, 130, '#FACC15', 0.55, 5);
          triggerHypeBanner(label, `${attacker.displayName} · +${bonus} STREAK BONUS`, '#FACC15');
        }
      }
      recomputeTeamTotalsFromFighters();

      if (attacker.isLocal) {
        overdriveChargeRef.current = Math.min(100, overdriveChargeRef.current + 28);
        spawnFloatingText(attacker.x, attacker.y - 36, `+${SCORE_RULES.KILL} PTS`, '#FACC15');
        grantLocalProgress(0, XP_REWARDS.KILL);
      }

      // Burst collectible Gold Coins from every knocked-out fighter!
      spawnCoinBurst(
        victim.x,
        victim.y,
        attacker.isLocal ? 4 : 2,
        COIN_REWARDS.DROP_COIN,
        'drop'
      );

      audioEngine.playElimination();
      spawnParticles(victim.x, victim.y, victim.color, 22, 220);
      spawnShockwave(victim.x, victim.y, 82, victim.color, 0.42, 4);
      pushKillFeed(
        `${attacker.displayName} KO'd ${victim.displayName} (${weaponLabel} · +${SCORE_RULES.KILL}${streakTag})`,
        attacker.team !== 'none' ? TEAM_META[attacker.team].color : attacker.color
      );
    };

    const triggerOverdriveNova = (caster: FighterEntity) => {
      if (caster.status !== 'alive' || overdriveChargeRef.current < 100) return;
      overdriveChargeRef.current = 0;

      // Defensive surge + massive spectacle
      caster.shield = Math.min(50, caster.shield + 25);
      caster.speedBoostSec = Math.max(caster.speedBoostSec, 3.0);
      cameraRef.current.shake = 14;
      hitstopRef.current = 0.05;
      audioEngine.playOverdriveNova();
      spawnShockwave(caster.x, caster.y, 215, '#38BDF8', 0.55, 6);
      spawnShockwave(caster.x, caster.y, 165, '#FACC15', 0.42, 4);
      spawnParticles(caster.x, caster.y, '#38BDF8', 26, 260);
      spawnParticles(caster.x, caster.y, '#FACC15', 14, 210);
      spawnFloatingText(caster.x, caster.y - 42, 'OVERDRIVE NOVA!', '#38BDF8');
      triggerHypeBanner('OVERDRIVE NOVA!', '205m Shockwave + Shield Surge', '#38BDF8', 1900);

      // Dispel nearby enemy Shroud Snares
      const hz = hazardsRef.current;
      for (let i = hz.length - 1; i >= 0; i--) {
        if (hz[i].ownerId !== caster.id && Math.hypot(hz[i].x - caster.x, hz[i].y - caster.y) <= 220) {
          hz.splice(i, 1);
        }
      }

      // Blast every enemy inside 205px radius
      const NOVA_RADIUS = 205;
      const NOVA_DAMAGE = 28;
      for (const target of fightersRef.current.values()) {
        if (target.id === caster.id || target.status !== 'alive') continue;
        if (areTeammates(caster, target)) continue;
        if (target.spawnShieldTimer > 0) continue;
        const dist = Math.hypot(target.x - caster.x, target.y - caster.y);
        if (dist > NOVA_RADIUS) continue;

        const ang = Math.atan2(target.y - caster.y, target.x - caster.x);
        const kbX = Math.cos(ang) * 420;
        const kbY = Math.sin(ang) * 420;
        addDamageScore(caster, NOVA_DAMAGE);

        if (mode === 'multi' && roomRef.current) {
          void emitRoomCombatHit(
            roomRef.current.roomId,
            caster.id,
            target.id,
            NOVA_DAMAGE,
            kbX,
            kbY
          );
          spawnParticles(target.x, target.y, '#38BDF8', 14, 210);
        } else {
          let remaining = NOVA_DAMAGE;
          if (target.shield > 0) {
            const absorbed = Math.min(target.shield, remaining);
            target.shield -= absorbed;
            remaining -= absorbed;
          }
          target.health = Math.max(0, target.health - remaining);
          target.lastHitBy = caster.id;
          target.lastDamagedAt = totalElapsedRef.current;
          target.hitFlashTimer = 0.24;
          target.animState = 'hit';
          target.knockbackVx += kbX;
          target.knockbackVy += kbY;
          spawnParticles(target.x, target.y, '#38BDF8', 14, 210);
          spawnFloatingText(target.x, target.y - 28, `-${NOVA_DAMAGE} NOVA!`, '#38BDF8');

          if (target.health <= 0) {
            recordElimination(caster, target, 'Overdrive Nova');
          }
        }
      }
      forceSyncRef.current = true;
    };

    const performWeaponAttack = (attacker: FighterEntity) => {
      if (attacker.status !== 'alive' || attacker.attackCooldown > 0) return;

      const spec = getWeaponSpec(attacker.weaponCategory, attacker.weaponRarity, getGunLevelFor(attacker));
      const powered = attacker.damageBoostSec > 0;
      const baseDamage = Math.round(spec.damage * (powered ? POWER_DAMAGE_MULTIPLIER : 1));
      const rarityAccent = RARITY_META[attacker.weaponRarity].color;

      // Bots get a tactical cadence buffer so skirmishes play out over exciting 6-10s exchanges
      attacker.attackCooldown = spec.cooldownSec + (attacker.isBot ? 0.34 : 0);
      attacker.attackTimer = spec.category === 'long' ? 0.28 : 0.2;
      attacker.animState = 'attack';
      if (attacker.isLocal) {
        attackSeqRef.current += 1;
        attacker.lastAttackSeq = attackSeqRef.current;
        forceSyncRef.current = true;
      }

      const closestTarget = findBestTargetFor(attacker);

      if (closestTarget) {
        attacker.facing = Math.atan2(closestTarget.y - attacker.y, closestTarget.x - attacker.x);
      }

      if (spec.category === 'close') {
        spawnSwingArc(
          attacker.x,
          attacker.y,
          attacker.facing,
          powered ? '#FB923C' : rarityAccent,
          powered || attacker.weaponRarity === 'rare',
          spec.range * 0.56
        );
      } else {
        const rawEndX = closestTarget
          ? closestTarget.x
          : attacker.x + Math.cos(attacker.facing) * Math.min(spec.range, 260);
        const rawEndY = closestTarget
          ? closestTarget.y
          : attacker.y + Math.sin(attacker.facing) * Math.min(spec.range, 260);
        const blockHit = closestTarget
          ? null
          : raycastObstacleHit(attacker.x, attacker.y, rawEndX, rawEndY, obstaclesRef.current);
        const endX = blockHit ? blockHit.x : rawEndX;
        const endY = blockHit ? blockHit.y : rawEndY;

        spawnBeamTrail(
          attacker.x,
          attacker.y,
          endX,
          endY,
          powered ? '#FB923C' : rarityAccent,
          spec.category
        );

        if (blockHit) {
          spawnParticles(blockHit.x, blockHit.y, '#E2E8F0', 7, 130);
          spawnParticles(blockHit.x, blockHit.y, '#F59E0B', 4, 150);
          spawnShockwave(blockHit.x, blockHit.y, 24, '#94A3B8', 0.18, 2.2);
          if (attacker.isLocal) {
            audioEngine.playCoverBlock();
          }
        }
      }

      if (attacker.isLocal) {
        audioEngine.playWeaponFire(spec.category, powered);
      }

      if (!closestTarget) return;

      // Directional Block Cover mitigation (-35% incoming damage & knockback when tucked behind a block)
      const targetCover = getCoverInfo(closestTarget.x, closestTarget.y, obstaclesRef.current, 24);
      const coverProtected = isProtectedByCoverFrom(
        closestTarget.x,
        closestTarget.y,
        attacker.x,
        attacker.y,
        targetCover
      );
      const damage = coverProtected ? Math.max(1, Math.round(baseDamage * 0.65)) : baseDamage;

      const angle = Math.atan2(closestTarget.y - attacker.y, closestTarget.x - attacker.x);
      const kbForce =
        (powered ? spec.knockback * 1.2 : spec.knockback) * (coverProtected ? 0.65 : 1);
      const kbX = Math.cos(angle) * kbForce;
      const kbY = Math.sin(angle) * kbForce;

      addDamageScore(attacker, damage);

      if (attacker.isLocal) {
        overdriveChargeRef.current = Math.min(100, overdriveChargeRef.current + damage * 0.9);
        cameraRef.current.shake = Math.min(
          14,
          cameraRef.current.shake + (spec.category === 'long' || powered ? 9 : 5)
        );
        hitstopRef.current = spec.category === 'long' || powered ? 0.045 : 0.024;
        if (coverProtected) {
          audioEngine.playCoverBlock();
        } else {
          audioEngine.playHit(damage >= 24);
        }
        forceSyncRef.current = true;
      }

      if (mode === 'multi' && attacker.isLocal && roomRef.current) {
        spawnParticles(
          closestTarget.x,
          closestTarget.y,
          coverProtected ? '#10B981' : rarityAccent,
          10,
          160
        );
        if (coverProtected) {
          spawnFloatingText(closestTarget.x, closestTarget.y - 36, 'COVER -35%', '#10B981');
        }
        if (damage >= 24) spawnShockwave(closestTarget.x, closestTarget.y, 48, rarityAccent, 0.25, 3);
        void emitRoomCombatHit(
          roomRef.current.roomId,
          attacker.id,
          closestTarget.id,
          baseDamage,
          kbX,
          kbY
        );
      } else {
        let remaining = damage;
        if (closestTarget.shield > 0) {
          const absorbed = Math.min(closestTarget.shield, remaining);
          closestTarget.shield -= absorbed;
          remaining -= absorbed;
        }
        closestTarget.health = Math.max(0, closestTarget.health - remaining);
        closestTarget.lastHitBy = attacker.id;
        closestTarget.lastDamagedAt = totalElapsedRef.current;
        closestTarget.hitFlashTimer = 0.18;
        closestTarget.animState = 'hit';
        closestTarget.knockbackVx += kbX;
        closestTarget.knockbackVy += kbY;

        spawnParticles(
          closestTarget.x,
          closestTarget.y,
          coverProtected ? '#10B981' : powered ? '#F97316' : rarityAccent,
          damage >= 24 ? 14 : 10,
          damage >= 24 ? 190 : 155
        );
        if (damage >= 24) {
          spawnShockwave(closestTarget.x, closestTarget.y, 52, '#FACC15', 0.28, 3);
        }
        spawnFloatingText(
          closestTarget.x,
          closestTarget.y - 26,
          coverProtected ? `-${damage} COVER` : damage >= 24 ? `-${damage}!` : `-${damage}`,
          coverProtected ? '#10B981' : damage >= 24 ? '#FACC15' : '#F8FAFC'
        );

        if (closestTarget.isLocal) {
          cameraRef.current.shake = Math.min(
            14,
            cameraRef.current.shake + (coverProtected ? 4.5 : 7.5)
          );
          if (coverProtected) {
            audioEngine.playCoverBlock();
          } else {
            audioEngine.playHit(damage >= 24);
          }
        }

        if (closestTarget.health <= 0) {
          recordElimination(attacker, closestTarget, spec.name);
        }
      }
    };

    const stepBot = (bot: FighterEntity, dt: number) => {
      if (bot.status !== 'alive') return;

      bot.botDecisionTimer = (bot.botDecisionTimer ?? 0) - dt;
      const zc = zoneCenterRef.current;
      const zr = zoneRadiusRef.current;
      const distToZoneCenter = Math.hypot(bot.x - zc.x, bot.y - zc.y);
      const spec = getWeaponSpec(bot.weaponCategory, bot.weaponRarity);

      // Find nearest alive ENEMY (respecting TDM teams and spawn shields)
      let nearestEnemy: FighterEntity | null = null;
      let nearestEnemyDist = Infinity;
      for (const other of fightersRef.current.values()) {
        if (other.id === bot.id || other.status !== 'alive') continue;
        if (areTeammates(bot, other)) continue;
        if (other.spawnShieldTimer > 0) continue;
        const d = Math.hypot(other.x - bot.x, other.y - bot.y);
        if (d < nearestEnemyDist) {
          nearestEnemyDist = d;
          nearestEnemy = other;
        }
      }

      const activePickups = getCurrentRoundPickups();
      let bestPickup: PickupData | null = null;
      let bestPickupScore = -1;
      for (const pk of activePickups) {
        if (!pk.active) continue;
        if (pk.type === 'medkit' && bot.health > 80) continue;
        if (isWeaponPickup(pk.type) && RARITY_RANK[pk.rarity] <= RARITY_RANK[bot.weaponRarity]) {
          continue;
        }
        const d = Math.hypot(pk.x - bot.x, pk.y - bot.y);
        const maxSearch = pk.rarity === 'rare' && (bot.botBoldness ?? 0.5) > 0.52 ? 620 : 280;
        if (d > maxSearch) continue;
        const score =
          (pk.rarity === 'rare' ? 320 : isWeaponPickup(pk.type) ? 160 : 100) - d * 0.45;
        if (score > bestPickupScore) {
          bestPickupScore = score;
          bestPickup = pk;
        }
      }

      if ((bot.botDecisionTimer ?? 0) <= 0) {
        bot.botDecisionTimer = 0.28 + Math.random() * 0.32;
        if (distToZoneCenter > zr * 0.84) {
          bot.botGoalX = zc.x + (Math.random() - 0.5) * zr * 0.36;
          bot.botGoalY = zc.y + (Math.random() - 0.5) * zr * 0.36;
        } else if (bot.health < 48 && nearestEnemy && nearestEnemyDist < 360) {
          // Tactical block cover seeking when wounded
          const coverSpot = findTacticalCoverPoint(
            bot.x,
            bot.y,
            nearestEnemy.x,
            nearestEnemy.y,
            obstaclesRef.current,
            300
          );
          if (coverSpot && Math.hypot(coverSpot.x - zc.x, coverSpot.y - zc.y) <= zr * 0.92) {
            bot.botGoalX = coverSpot.x;
            bot.botGoalY = coverSpot.y;
          } else if (bestPickup) {
            bot.botGoalX = bestPickup.x;
            bot.botGoalY = bestPickup.y;
          } else {
            const awayAng = Math.atan2(bot.y - nearestEnemy.y, bot.x - nearestEnemy.x);
            bot.botGoalX = bot.x + Math.cos(awayAng) * 140;
            bot.botGoalY = bot.y + Math.sin(awayAng) * 140;
          }
        } else if (
          bestPickup &&
          (bestPickup.rarity === 'rare' || bot.health < 75 || nearestEnemyDist > 180)
        ) {
          bot.botGoalX = bestPickup.x;
          bot.botGoalY = bestPickup.y;
        } else if (nearestEnemy && nearestEnemyDist < Math.max(380, spec.range + 75)) {
          if (bot.weaponCategory === 'long' && nearestEnemyDist < 190) {
            const awayAng = Math.atan2(bot.y - nearestEnemy.y, bot.x - nearestEnemy.x);
            bot.botGoalX = bot.x + Math.cos(awayAng) * 140;
            bot.botGoalY = bot.y + Math.sin(awayAng) * 140;
          } else {
            bot.botGoalX = nearestEnemy.x;
            bot.botGoalY = nearestEnemy.y;
          }
        } else {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * Math.max(55, zr * 0.62);
          bot.botGoalX = zc.x + Math.cos(ang) * r;
          bot.botGoalY = zc.y + Math.sin(ang) * r;
        }
      }

      const gx = bot.botGoalX ?? zc.x;
      const gy = bot.botGoalY ?? zc.y;
      const dx = gx - bot.x;
      const dy = gy - bot.y;
      const d = Math.hypot(dx, dy);

      const snareMul = getSnareSlowMultiplier(bot.id, bot.team, bot.x, bot.y, hazardsRef.current);
      const speedMul =
        (bot.speedBoostSec > 0 ? SPEED_BOOST_MULTIPLIER : 1) *
        (distToZoneCenter > zr * 0.86 ? 1.15 : 0.94) *
        snareMul;

      if (d > 14) {
        bot.vx = (dx / d) * BASE_SPEED * speedMul;
        bot.vy = (dy / d) * BASE_SPEED * speedMul;
        bot.facing = Math.atan2(dy, dx);
        bot.animPhase += dt * (speedMul > 1.05 ? 10.5 : 7.8);
        if (bot.attackTimer <= 0 && bot.hitFlashTimer <= 0) {
          bot.animState = speedMul > 1.05 ? 'run' : 'walk';
        }
      } else {
        bot.vx = 0;
        bot.vy = 0;
        bot.animPhase += dt * 2.5;
        if (bot.attackTimer <= 0 && bot.hitFlashTimer <= 0) {
          bot.animState = 'idle';
        }
      }

      const nextX = bot.x + (bot.vx + bot.knockbackVx) * dt;
      const nextY = bot.y + (bot.vy + bot.knockbackVy) * dt;
      const resolved = resolveArenaCollisions(nextX, nextY, obstaclesRef.current);
      bot.x = resolved.x;
      bot.y = resolved.y;

      if (
        bot.utilityCharges > 0 &&
        bot.utilityCooldown <= 0 &&
        nearestEnemy &&
        nearestEnemyDist < 185 &&
        (bot.health < 65 || getMapZoneAt(bot.x, bot.y) === 'resource')
      ) {
        bot.facing = Math.atan2(nearestEnemy.y - bot.y, nearestEnemy.x - bot.x);
        deployUtility(bot);
      }

      if (bot.attackCooldown <= 0) {
        const target = findBestTargetFor(bot);
        if (target) {
          performWeaponAttack(bot);
        }
      }

      for (const pk of activePickups) {
        if (!pk.active) continue;
        if (Math.hypot(pk.x - bot.x, pk.y - bot.y) < PICKUP_RANGE) {
          if (isWeaponPickup(pk.type) && RARITY_RANK[pk.rarity] <= RARITY_RANK[bot.weaponRarity]) {
            continue;
          }
          pk.active = false;
          pk.claimedBy = bot.id;
          applyPickupEffect(bot, pk);
        }
      }
    };

    const resolveRoundEnd = (
      currentRoom: RoomData | null | undefined,
      isHost: boolean
    ) => {
      const allFighters = Array.from(fightersRef.current.values());
      const aliveFighters = allFighters.filter((f) => f.status === 'alive');
      const roundNum = currentRoundRef.current;

      // Survival Last Standing bonus (+50 pts)
      if (gameMode === 'survival' && aliveFighters.length === 1) {
        const survivor = aliveFighters[0];
        if (mode === 'solo' || survivor.isLocal) {
          survivor.points += SCORE_RULES.SURVIVAL_BONUS;
          survivor.roundPoints += SCORE_RULES.SURVIVAL_BONUS;
        }
      }

      const redFighters = allFighters.filter((f) => f.team === 'red');
      const blueFighters = allFighters.filter((f) => f.team === 'blue');
      const redRoundPts = Math.round(redFighters.reduce((s, f) => s + f.roundPoints, 0));
      const blueRoundPts = Math.round(blueFighters.reduce((s, f) => s + f.roundPoints, 0));
      const redRoundKills = redFighters.reduce((s, f) => s + f.roundKills, 0);
      const blueRoundKills = blueFighters.reduce((s, f) => s + f.roundKills, 0);

      let winnerTeam: TeamId = 'none';
      let winnerLabel = 'Round Complete';
      let winnerAccent = '#F59E0B';

      if (gameMode === 'tdm') {
        if (redRoundPts > blueRoundPts || (redRoundPts === blueRoundPts && redRoundKills > blueRoundKills)) {
          winnerTeam = 'red';
          winnerLabel = TEAM_META.red.name;
          winnerAccent = TEAM_META.red.color;
          redRoundsWonRef.current += 1;
          for (const f of redFighters) {
            if (mode === 'solo' || f.isLocal) {
              f.roundWins += 1;
              f.points += SCORE_RULES.ROUND_WIN;
              f.roundPoints += SCORE_RULES.ROUND_WIN;
            }
          }
        } else if (
          blueRoundPts > redRoundPts ||
          (blueRoundPts === redRoundPts && blueRoundKills > redRoundKills)
        ) {
          winnerTeam = 'blue';
          winnerLabel = TEAM_META.blue.name;
          winnerAccent = TEAM_META.blue.color;
          blueRoundsWonRef.current += 1;
          for (const f of blueFighters) {
            if (mode === 'solo' || f.isLocal) {
              f.roundWins += 1;
              f.points += SCORE_RULES.ROUND_WIN;
              f.roundPoints += SCORE_RULES.ROUND_WIN;
            }
          }
        } else {
          winnerLabel = 'Round Tied';
          winnerAccent = '#94A3B8';
        }
        recomputeTeamTotalsFromFighters();
      } else {
        const sortedRound = [...allFighters].sort(
          (a, b) =>
            b.roundPoints - a.roundPoints ||
            (b.status === 'alive' ? 1 : 0) - (a.status === 'alive' ? 1 : 0) ||
            b.roundKills - a.roundKills ||
            b.health + b.shield - (a.health + a.shield)
        );
        const rWin = sortedRound[0];
        if (rWin) {
          winnerLabel = rWin.displayName;
          winnerAccent = rWin.color;
          if (mode === 'solo' || rWin.isLocal) {
            rWin.roundWins += 1;
            rWin.points += SCORE_RULES.ROUND_WIN;
            rWin.roundPoints += SCORE_RULES.ROUND_WIN;
          }
        }
      }

      const topAvatar = [...allFighters].sort(
        (a, b) => b.roundPoints - a.roundPoints || b.roundKills - a.roundKills
      )[0];

      const record: RoundResultRecord = {
        round: roundNum,
        winnerLabel,
        winnerTeam,
        winnerAccent,
        redRoundPoints: Math.round(redFighters.reduce((s, f) => s + f.roundPoints, 0)),
        blueRoundPoints: Math.round(blueFighters.reduce((s, f) => s + f.roundPoints, 0)),
        topAvatarName: topAvatar?.displayName ?? 'Fighter',
        topAvatarPoints: Math.round(topAvatar?.roundPoints ?? 0),
      };
      roundsHistoryRef.current = [...roundsHistoryRef.current, record];
      lastRoundResultRef.current = record;
      forceSyncRef.current = true;
      audioEngine.playRoundEnd();

      // Award local round-win Gold Coins & XP
      const localRoundFighter = fightersRef.current.get(localUserId);
      if (localRoundFighter) {
        const localWonThisRound =
          gameMode === 'tdm'
            ? winnerTeam !== 'none' && localRoundFighter.team === winnerTeam
            : winnerLabel === localRoundFighter.displayName;
        if (localWonThisRound) {
          grantLocalProgress(COIN_REWARDS.ROUND_WIN, XP_REWARDS.ROUND_WIN);
        } else {
          grantLocalProgress(10, 20);
        }
      }

      // Check whether that was the final round
      if (roundNum >= totalRoundsRef.current) {
        const avatarScores = buildAvatarScoreEntries();
        const local = fightersRef.current.get(localUserId);
        const localRank = Math.max(
          1,
          avatarScores.findIndex((a) => a.id === localUserId) + 1
        );
        const mvp = avatarScores[0];

        let winnerId = mvp?.id ?? '';
        let winnerName = mvp?.displayName ?? 'Champion';
        let won = mvp?.id === localUserId;

        if (gameMode === 'tdm') {
          const redWon =
            redScoreRef.current > blueScoreRef.current ||
            (redScoreRef.current === blueScoreRef.current &&
              redRoundsWonRef.current > blueRoundsWonRef.current);
          const blueWon =
            blueScoreRef.current > redScoreRef.current ||
            (blueScoreRef.current === redScoreRef.current &&
              blueRoundsWonRef.current > redRoundsWonRef.current);

          if (redWon) {
            winnerId = 'team_red';
            winnerName = TEAM_META.red.name;
            won = local?.team === 'red';
          } else if (blueWon) {
            winnerId = 'team_blue';
            winnerName = TEAM_META.blue.name;
            won = local?.team === 'blue';
          } else {
            winnerId = 'draw';
            winnerName = 'Match Draw';
            won = false;
          }
        }

        if (mode === 'solo') {
          matchEndedRef.current = true;
          if (won) audioEngine.playVictory();
          grantLocalProgress(
            COIN_REWARDS.MATCH_COMPLETE + (won ? COIN_REWARDS.MATCH_VICTORY : 0),
            XP_REWARDS.MATCH_COMPLETE + (won ? XP_REWARDS.MATCH_VICTORY : 0),
            true
          );
          onMatchComplete({
            won,
            winnerName,
            placement: localRank,
            totalPlayers: avatarScores.length,
            kills: local?.kills ?? 0,
            deaths: local?.deaths ?? 0,
            points: Math.round(local?.points ?? 0),
            damageDealt: Math.round(local?.damageDealt ?? 0),
            roundWins: local?.roundWins ?? 0,
            timeSurvivedSec: Math.round(totalElapsedRef.current),
            mode: 'solo',
            gameMode,
            totalRounds: totalRoundsRef.current,
            localTeam: local?.team ?? 'none',
            redScore: redScoreRef.current,
            blueScore: blueScoreRef.current,
            redRoundsWon: redRoundsWonRef.current,
            blueRoundsWon: blueRoundsWonRef.current,
            mvpName: mvp?.displayName ?? localCustomization.displayName,
            roundsHistory: [...roundsHistoryRef.current],
            avatarScores,
            coinsEarned: sessionCoinsRef.current,
            xpEarned: sessionXpRef.current,
            leveledUp: leveledUpInMatchRef.current,
            newLevel: liveLevelRef.current,
          });
        } else if (isHost && currentRoom) {
          matchEndedRef.current = true;
          if (won) audioEngine.playVictory();
          void finishRoomMatch(currentRoom.roomId, winnerId, winnerName, 0, {
            redScore: redScoreRef.current,
            blueScore: blueScoreRef.current,
            redRoundsWon: redRoundsWonRef.current,
            blueRoundsWon: blueRoundsWonRef.current,
          });
        }
      } else {
        // Enter 4.5s between-round scorecard intermission
        roundPhaseRef.current = 'intermission';
        intermissionLeftRef.current = ROUND_INTERMISSION_SEC;
        if (mode === 'multi' && isHost && currentRoom) {
          void syncHostZoneTick(currentRoom.roomId, {
            currentRound: currentRoundRef.current,
            roundPhase: 'intermission',
            redScore: redScoreRef.current,
            blueScore: blueScoreRef.current,
            redRoundsWon: redRoundsWonRef.current,
            blueRoundsWon: blueRoundsWonRef.current,
            zoneRadius: zoneRadiusRef.current,
            zoneTargetRadius: zoneTargetRadiusRef.current,
            zoneCenterX: zoneCenterRef.current.x,
            zoneCenterY: zoneCenterRef.current.y,
            timeRemainingSec: 0,
          });
        }
      }
    };

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      if (pausedRef.current && mode === 'solo') {
        return;
      }

      if (hitstopRef.current > 0) {
        hitstopRef.current = Math.max(0, hitstopRef.current - dt);
        setRenderTick((t) => (t + 1) & 0xffff);
        return;
      }

      const currentRoom = roomRef.current;
      const isHost = mode === 'solo' || Boolean(currentRoom && currentRoom.hostId === localUserId);
      const local = fightersRef.current.get(localUserId);

      // Handle Between-Round Intermission Phase
      if (roundPhaseRef.current === 'intermission') {
        intermissionLeftRef.current = Math.max(0, intermissionLeftRef.current - dt);
        // Drain input buffers so players don't accidentally fire frame 1 of next round
        justPressedAttackRef.current = false;
        justPressedDashRef.current = false;
        justPressedUtilityRef.current = false;
        justPressedSwapRef.current = false;
        justPressedNovaRef.current = false;
        justPressedCoverRef.current = false;

        if (isHost && !matchEndedRef.current && intermissionLeftRef.current <= 0) {
          const nextRound = Math.min(totalRoundsRef.current, currentRoundRef.current + 1);
          currentRoundRef.current = nextRound;
          roundPhaseRef.current = 'active';
          resetArenaForNewRound(nextRound);
          if (mode === 'multi' && currentRoom) {
            void startNextRoomRound(
              currentRoom,
              nextRound,
              redScoreRef.current,
              blueScoreRef.current,
              redRoundsWonRef.current,
              blueRoundsWonRef.current
            );
          }
        }
      } else if (roundCountdownRef.current > 0) {
        // Pre-Round 3-2-1-FIGHT! Staging Countdown
        roundCountdownRef.current = Math.max(0, roundCountdownRef.current - dt);
        justPressedAttackRef.current = false;
        justPressedDashRef.current = false;
        justPressedUtilityRef.current = false;
        justPressedSwapRef.current = false;
        justPressedNovaRef.current = false;
        justPressedCoverRef.current = false;

        const nextInt = Math.ceil(roundCountdownRef.current);
        if (nextInt < lastCountdownIntRef.current && nextInt > 0) {
          lastCountdownIntRef.current = nextInt;
          audioEngine.playCountdownTick(false);
        } else if (roundCountdownRef.current <= 0) {
          lastCountdownIntRef.current = 0;
          audioEngine.playCountdownTick(true);
          if (local) {
            spawnShockwave(local.x, local.y, 130, '#F59E0B', 0.45, 4.5);
          }
          triggerHypeBanner(
            `ROUND ${currentRoundRef.current} · FIGHT!`,
            gameMode === 'tdm'
              ? 'Score KOs, Claim Vault Gold & Hold the Zone!'
              : 'Resurgence Active for First 65% · Claim Vault Gold!',
            '#F59E0B',
            2000
          );
        }
      } else {
        // Active Round Gameplay Simulation
        roundElapsedRef.current += dt;
        totalElapsedRef.current += dt;

        // Passive combat adrenaline charges Overdrive slightly while alive
        if (local && local.status === 'alive') {
          overdriveChargeRef.current = Math.min(100, overdriveChargeRef.current + dt * 1.6);
        }

        // Mid-Round Golden Vault Supply Drop at 50% of every round!
        if (!midRoundDropSpawnedRef.current && roundElapsedRef.current >= roundDurationRef.current * 0.5) {
          midRoundDropSpawnedRef.current = true;
          if (mode === 'solo') {
            const dropItems = generateMidRoundSupplyDrop(
              'SOLO',
              seedRef.current,
              obstaclesRef.current,
              currentRoundRef.current
            ).map((p) => ({ ...p, claimedBy: '' }));
            pickupsRef.current = [...pickupsRef.current, ...dropItems];
          }
          audioEngine.playSupplyDrop();
          spawnCoinBurst(0, 0, 5, COIN_REWARDS.VAULT_COIN, 'vault');
          spawnShockwave(0, 0, 220, '#FACC15', 0.75, 5.5);
          spawnParticles(0, 0, '#FACC15', 24, 195);
          triggerHypeBanner(
            'VAULT SUPPLY DROP!',
            'Rare Gold Weapon + 5 Vault Gold Coins Dropped in Center!',
            '#FACC15',
            2800
          );
          pushKillFeed('Mid-Round Vault Supply Drop + Gold Coins landed at center!', '#FACC15');
        }

        // Survival Resurgence Lock Announcement at 65% of each round
        const resurgenceActive =
          gameMode === 'survival' &&
          roundElapsedRef.current < roundDurationRef.current * SURVIVAL_RESURGENCE_FRAC;
        if (
          gameMode === 'survival' &&
          !suddenDeathAnnouncedRef.current &&
          !resurgenceActive
        ) {
          suddenDeathAnnouncedRef.current = true;
          audioEngine.playSuddenDeath();
          spawnShockwave(zoneCenterRef.current.x, zoneCenterRef.current.y, 240, '#EF4444', 0.7, 5);
          triggerHypeBanner(
            'FINAL SHOWDOWN!',
            'Respawns Locked — Last Fighter Takes +50 Survival Bonus!',
            '#EF4444',
            3000
          );
          pushKillFeed('FINAL SHOWDOWN — Survival respawns locked!', '#EF4444');
        }

        // Update per-round shrinking timing zone
        if (isHost) {
          const z = computeZoneState(
            roundElapsedRef.current,
            roundDurationRef.current,
            ARENA_RADIUS,
            zoneCenterRef.current.x,
            zoneCenterRef.current.y,
            currentRoundRef.current,
            totalRoundsRef.current
          );
          zoneRadiusRef.current = z.zoneRadius;
          zoneTargetRadiusRef.current = z.zoneTargetRadius;
          phaseLabelRef.current = z.phaseLabel;

          if (mode === 'multi' && currentRoom && now - lastHostZoneSyncRef.current >= 900) {
            lastHostZoneSyncRef.current = now;
            const timeLeft = Math.max(0, roundDurationRef.current - roundElapsedRef.current);
            void syncHostZoneTick(currentRoom.roomId, {
              currentRound: currentRoundRef.current,
              roundPhase: 'active',
              redScore: redScoreRef.current,
              blueScore: blueScoreRef.current,
              redRoundsWon: redRoundsWonRef.current,
              blueRoundsWon: blueRoundsWonRef.current,
              zoneRadius: zoneRadiusRef.current,
              zoneTargetRadius: zoneTargetRadiusRef.current,
              zoneCenterX: zoneCenterRef.current.x,
              zoneCenterY: zoneCenterRef.current.y,
              timeRemainingSec: timeLeft,
            });
          }
        } else if (currentRoom) {
          const alpha = 1 - Math.exp(-5 * dt);
          zoneRadiusRef.current += (currentRoom.zoneRadius - zoneRadiusRef.current) * alpha;
          zoneTargetRadiusRef.current = currentRoom.zoneTargetRadius;
          zoneCenterRef.current.x = currentRoom.zoneCenterX;
          zoneCenterRef.current.y = currentRoom.zoneCenterY;
          const elapsedApprox = Math.max(
            0,
            currentRoom.roundDurationSec - currentRoom.timeRemainingSec
          );
          if (Math.abs(elapsedApprox - roundElapsedRef.current) > 1.5) {
            roundElapsedRef.current = elapsedApprox;
          }
          const z = computeZoneState(
            elapsedApprox,
            currentRoom.roundDurationSec,
            currentRoom.arenaRadius,
            currentRoom.zoneCenterX,
            currentRoom.zoneCenterY,
            currentRoom.currentRound,
            currentRoom.totalRounds
          );
          phaseLabelRef.current = z.phaseLabel;
        }

        // Tick Kinetic Boost Pads cooldowns
        for (const pad of jumpPadsRef.current) {
          pad.cooldown = Math.max(0, pad.cooldown - dt);
        }

        // Tick active area utility hazards
        const hazards = hazardsRef.current;
        for (let i = hazards.length - 1; i >= 0; i--) {
          hazards[i].life -= dt;
          if (hazards[i].life <= 0) {
            hazards.splice(i, 1);
          }
        }

        // Ambient golden shimmer on unclaimed Rare Gold loot in current round
        rareSparkleTimerRef.current += dt;
        if (rareSparkleTimerRef.current >= 0.32) {
          rareSparkleTimerRef.current = 0;
          for (const pk of getCurrentRoundPickups()) {
            if (pk.active && pk.rarity === 'rare') {
              spawnParticles(pk.x, pk.y, '#FACC15', 2, 42);
            }
          }
        }

        ghostSpawnTimerRef.current += dt;
        const emitGhostThisFrame = ghostSpawnTimerRef.current >= 0.055;
        if (emitGhostThisFrame) ghostSpawnTimerRef.current = 0;

        regenSparkleTimerRef.current += dt;
        const emitRegenSparkle = regenSparkleTimerRef.current >= 0.4;
        if (emitRegenSparkle) regenSparkleTimerRef.current = 0;

        const zc = zoneCenterRef.current;
        const zr = zoneRadiusRef.current;
        const activePickups = getCurrentRoundPickups();

        for (const fighter of fightersRef.current.values()) {
          fighter.attackCooldown = Math.max(0, fighter.attackCooldown - dt);
          fighter.attackTimer = Math.max(0, fighter.attackTimer - dt);
          fighter.hitFlashTimer = Math.max(0, fighter.hitFlashTimer - dt);
          fighter.dashCooldown = Math.max(0, fighter.dashCooldown - dt);
          fighter.dashTimer = Math.max(0, fighter.dashTimer - dt);
          fighter.utilityCooldown = Math.max(0, fighter.utilityCooldown - dt);
          fighter.speedBoostSec = Math.max(0, fighter.speedBoostSec - dt);
          fighter.damageBoostSec = Math.max(0, fighter.damageBoostSec - dt);
          fighter.spawnShieldTimer = Math.max(0, fighter.spawnShieldTimer - dt);

          const kbDecay = Math.exp(-8.5 * dt);
          fighter.knockbackVx *= kbDecay;
          fighter.knockbackVy *= kbDecay;
          if (Math.hypot(fighter.knockbackVx, fighter.knockbackVy) < 4) {
            fighter.knockbackVx = 0;
            fighter.knockbackVy = 0;
          }

          // Dash & Kinetic Launch Afterimages
          if (
            emitGhostThisFrame &&
            fighter.status === 'alive' &&
            (fighter.dashTimer > 0 || Math.hypot(fighter.knockbackVx, fighter.knockbackVy) > 220)
          ) {
            spawnDashGhost(fighter.x, fighter.y, fighter.color);
          }

          // Auto-Respawn Countdown: ALWAYS on in TDM (3.0s) & ON during first 65% Resurgence in Survival (4.0s)
          const canRespawnNow = gameMode === 'tdm' || resurgenceActive;
          if (
            canRespawnNow &&
            fighter.status === 'downed' &&
            (fighter.isLocal || fighter.isBot)
          ) {
            if (fighter.respawnTimer <= 0) {
              fighter.respawnTimer = gameMode === 'tdm' ? TDM_RESPAWN_SEC : SURVIVAL_RESPAWN_SEC;
            }
            fighter.respawnTimer = Math.max(0, fighter.respawnTimer - dt);
            if (fighter.respawnTimer <= 0) {
              // Safe-zone clamped respawn fixes respawn-in-storm bug!
              const spawn = computeSpawnForFighter(fighter.id, currentRoundRef.current, {
                x: zc.x,
                y: zc.y,
                radius: zr,
              });
              fighter.x = spawn.x;
              fighter.y = spawn.y;
              fighter.targetX = spawn.x;
              fighter.targetY = spawn.y;
              fighter.vx = 0;
              fighter.vy = 0;
              fighter.knockbackVx = 0;
              fighter.knockbackVy = 0;
              fighter.health = 100;
              fighter.shield = STARTING_SHIELD;
              fighter.status = 'alive';
              fighter.animState = 'idle';
              fighter.spawnShieldTimer = SPAWN_SHIELD_SEC;
              fighter.lastDamagedAt = totalElapsedRef.current;
              fighter.weaponCategory = 'close';
              fighter.weaponRarity = 'common';
              fighter.lastHitBy = '';
              spawnParticles(
                spawn.x,
                spawn.y,
                fighter.team !== 'none' ? TEAM_META[fighter.team].color : '#38BDF8',
                16,
                160
              );
              spawnShockwave(spawn.x, spawn.y, 70, '#38BDF8', 0.4, 3.5);
              if (fighter.isLocal) {
                spawnFloatingText(spawn.x, spawn.y - 30, 'RESPAWNED · SHIELDED', '#38BDF8');
                forceSyncRef.current = true;
              }
            }
          }

          if (fighter.isLocal) {
            if (fighter.status === 'alive') {
              let ix = 0;
              let iy = 0;
              const held = keysHeldRef.current;
              if (held.has('w') || held.has('arrowup')) iy -= 1;
              if (held.has('s') || held.has('arrowdown')) iy += 1;
              if (held.has('a') || held.has('arrowleft')) ix -= 1;
              if (held.has('d') || held.has('arrowright')) ix += 1;

              if (Math.hypot(joyVecRef.current.x, joyVecRef.current.y) > 0.12) {
                ix = joyVecRef.current.x;
                iy = joyVecRef.current.y;
              } else if (ix === 0 && iy === 0 && pointerMoveRef.current.active) {
                const pdx = pointerMoveRef.current.worldX - fighter.x;
                const pdy = pointerMoveRef.current.worldY - fighter.y;
                const pd = Math.hypot(pdx, pdy);
                if (pd > 16) {
                  ix = pdx / pd;
                  iy = pdy / pd;
                }
              }

              const mag = Math.hypot(ix, iy);
              if (mag > 1) {
                ix /= mag;
                iy /= mag;
              }

              if (justPressedNovaRef.current) {
                justPressedNovaRef.current = false;
                triggerOverdriveNova(fighter);
              }

              if (justPressedDashRef.current) {
                justPressedDashRef.current = false;
                if (fighter.dashCooldown <= 0) {
                  fighter.dashTimer = 0.24;
                  fighter.dashCooldown = 2.6;
                  audioEngine.playDash();
                  spawnParticles(fighter.x, fighter.y + 12, '#CBD5E1', 8, 95);
                  spawnShockwave(fighter.x, fighter.y + 10, 40, '#94A3B8', 0.22, 2.5);
                }
              }

              if (justPressedCoverRef.current) {
                justPressedCoverRef.current = false;
                const snap = snapToNearestCoverBlock(
                  fighter.x,
                  fighter.y,
                  obstaclesRef.current,
                  68
                );
                if (snap) {
                  fighter.x = snap.x;
                  fighter.y = snap.y;
                  fighter.vx = 0;
                  fighter.vy = 0;
                  audioEngine.playCoverSnap();
                  spawnParticles(snap.cover.contactX, snap.cover.contactY, '#10B981', 8, 95);
                  spawnShockwave(fighter.x, fighter.y + 8, 34, '#10B981', 0.24, 2.5);
                  spawnFloatingText(fighter.x, fighter.y - 30, 'IN COVER · -35% DMG', '#10B981');
                  forceSyncRef.current = true;
                }
              }

              if (justPressedUtilityRef.current) {
                justPressedUtilityRef.current = false;
                deployUtility(fighter);
              }

              const shouldAutoShoot =
                autoFireRef.current &&
                fighter.attackCooldown <= 0 &&
                Boolean(findBestTargetFor(fighter));

              if (justPressedAttackRef.current || isHoldingAttackRef.current || shouldAutoShoot) {
                justPressedAttackRef.current = false;
                performWeaponAttack(fighter);
              }

              const isDashing = fighter.dashTimer > 0;
              const snareMul = getSnareSlowMultiplier(
                fighter.id,
                fighter.team,
                fighter.x,
                fighter.y,
                hazardsRef.current
              );
              const speedMul =
                (isDashing ? SPRINT_MULTIPLIER * 1.28 : 1) *
                (fighter.speedBoostSec > 0 ? SPEED_BOOST_MULTIPLIER : 1) *
                (isDashing ? 1 : snareMul);

              fighter.vx = ix * BASE_SPEED * speedMul;
              fighter.vy = iy * BASE_SPEED * speedMul;

              const nextX = fighter.x + (fighter.vx + fighter.knockbackVx) * dt;
              const nextY = fighter.y + (fighter.vy + fighter.knockbackVy) * dt;
              const resolved = resolveArenaCollisions(nextX, nextY, obstaclesRef.current);
              fighter.x = resolved.x;
              fighter.y = resolved.y;

              const spd = Math.hypot(fighter.vx, fighter.vy);
              if (spd > 12) {
                fighter.facing = Math.atan2(fighter.vy, fighter.vx);
                fighter.animPhase += dt * (spd / 24);
                if (fighter.attackTimer <= 0 && fighter.hitFlashTimer <= 0) {
                  fighter.animState = isDashing || fighter.speedBoostSec > 0 ? 'run' : 'walk';
                }
              } else {
                fighter.animPhase += dt * 2.4;
                if (fighter.attackTimer <= 0 && fighter.hitFlashTimer <= 0) {
                  fighter.animState = 'idle';
                }
              }

              const wantSwap = justPressedSwapRef.current;
              justPressedSwapRef.current = false;

              for (const pk of activePickups) {
                if (!pk.active) continue;
                if (Math.hypot(pk.x - fighter.x, pk.y - fighter.y) >= PICKUP_RANGE) continue;

                const isWep = isWeaponPickup(pk.type);
                const isUpgrade =
                  isWep && RARITY_RANK[pk.rarity] > RARITY_RANK[fighter.weaponRarity];
                const canSwap =
                  isWep &&
                  wantSwap &&
                  (pk.type !== fighter.weaponCategory || pk.rarity !== fighter.weaponRarity);

                if (!isWep || isUpgrade || canSwap) {
                  pk.active = false;
                  pk.claimedBy = fighter.id;
                  applyPickupEffect(fighter, pk);
                  if (mode === 'multi' && currentRoom) {
                    void claimRoomPickup(currentRoom.roomId, pk.pickupId, fighter.id);
                  }
                  if (canSwap) break;
                }
              }
            } else {
              fighter.vx = 0;
              fighter.vy = 0;
              fighter.animState = 'downed';
              justPressedAttackRef.current = false;
              isHoldingAttackRef.current = false;
              justPressedDashRef.current = false;
              justPressedUtilityRef.current = false;
              justPressedSwapRef.current = false;
              justPressedNovaRef.current = false;
              justPressedCoverRef.current = false;
            }
          } else if (fighter.isBot) {
            stepBot(fighter, dt);
          } else {
            interpolateRemoteFighter(fighter, dt);
          }

          // Kinetic Jump / Boost Pads launch fighters forward for thrilling flanks & escapes!
          if (fighter.status === 'alive' && (fighter.isLocal || fighter.isBot)) {
            for (const pad of jumpPadsRef.current) {
              if (pad.cooldown > 0) continue;
              if (Math.hypot(fighter.x - pad.x, fighter.y - pad.y) <= 30) {
                pad.cooldown = 3.8;
                const launchAng =
                  Math.hypot(fighter.vx, fighter.vy) > 15
                    ? Math.atan2(fighter.vy, fighter.vx)
                    : fighter.facing;
                fighter.knockbackVx += Math.cos(launchAng) * 440;
                fighter.knockbackVy += Math.sin(launchAng) * 440;
                fighter.speedBoostSec = Math.max(fighter.speedBoostSec, 2.5);
                spawnShockwave(pad.x, pad.y, 92, '#22D3EE', 0.42, 4);
                spawnParticles(pad.x, pad.y, '#22D3EE', 14, 185);
                if (fighter.isLocal) {
                  audioEngine.playJumpPad();
                  cameraRef.current.shake = Math.min(10, cameraRef.current.shake + 4.5);
                  spawnFloatingText(fighter.x, fighter.y - 30, 'KINETIC BOOST!', '#22D3EE');
                }
                break;
              }
            }
          }

          // Safe-zone out-of-combat regeneration OR shrinking storm damage
          if (fighter.status === 'alive' && (fighter.isLocal || fighter.isBot)) {
            const distFromZone = Math.hypot(fighter.x - zc.x, fighter.y - zc.y);
            if (distFromZone > zr) {
              if (fighter.spawnShieldTimer <= 0) {
                const stormDps = zr < 200 ? 11 : zr < 400 ? 7.5 : 4.5;
                fighter.health = Math.max(0, fighter.health - stormDps * dt);
                fighter.lastDamagedAt = totalElapsedRef.current;
                if (fighter.isLocal) {
                  stormAudioCooldownRef.current -= dt;
                  if (stormAudioCooldownRef.current <= 0) {
                    stormAudioCooldownRef.current = 0.85;
                    audioEngine.playStormTick();
                  }
                }
                if (fighter.health <= 0) {
                  fighter.status = 'downed';
                  fighter.animState = 'downed';
                  fighter.deaths += 1;
                  fighter.roundDeaths += 1;
                  fighter.lastHitBy = '';
                  streaksRef.current.set(fighter.id, 0);
                  if (gameMode === 'tdm') {
                    fighter.respawnTimer = TDM_RESPAWN_SEC;
                  } else if (resurgenceActive) {
                    fighter.respawnTimer = SURVIVAL_RESPAWN_SEC;
                  }
                  audioEngine.playElimination();
                  spawnParticles(fighter.x, fighter.y, '#EF4444', 18, 175);
                  spawnShockwave(fighter.x, fighter.y, 74, '#EF4444', 0.4, 3.5);
                  pushKillFeed(`${fighter.displayName} fell to the storm`, '#EF4444');
                  if (fighter.isLocal) forceSyncRef.current = true;
                }
              }
            } else if (fighter.health < 100) {
              // Out-of-combat HP regeneration inside the safe zone (1.5x faster & earlier when tucked behind block cover!)
              const inBlockCover = Boolean(
                getCoverInfo(fighter.x, fighter.y, obstaclesRef.current, 24)
              );
              const regenDelay = inBlockCover ? REGEN_DELAY_SEC * 0.6 : REGEN_DELAY_SEC;
              const regenRate = inBlockCover ? REGEN_HP_PER_SEC * 1.5 : REGEN_HP_PER_SEC;
              if (totalElapsedRef.current - fighter.lastDamagedAt >= regenDelay) {
                fighter.health = Math.min(100, fighter.health + regenRate * dt);
                if (emitRegenSparkle) {
                  spawnParticles(fighter.x, fighter.y - 6, '#10B981', inBlockCover ? 3 : 2, 38);
                }
              }
            }
          }
        }

        // Round resolution check (Host / Solo drives round completion)
        // Guarantees 3-5 minute matches: TDM always runs full round timer; Survival only ends early AFTER 65% Resurgence lock!
        if (!matchEndedRef.current && isHost) {
          const allFighters = Array.from(fightersRef.current.values());
          const aliveFighters = allFighters.filter((f) => f.status === 'alive');
          const roundTimeRemaining = Math.max(0, roundDurationRef.current - roundElapsedRef.current);

          let shouldEndRound = roundTimeRemaining <= 0;
          if (!shouldEndRound && gameMode === 'survival' && !resurgenceActive) {
            if (mode === 'solo') {
              shouldEndRound = aliveFighters.length <= 1;
            } else {
              const enoughPlayers = allFighters.length >= 2;
              shouldEndRound =
                (enoughPlayers && aliveFighters.length <= 1) ||
                (!enoughPlayers && aliveFighters.length === 0);
            }
          }

          if (shouldEndRound) {
            resolveRoundEnd(currentRoom, isHost);
          }
        }
      }

      // Multiplayer: push local player state & calculated per-avatar stats at 4 Hz (250ms)
      if (
        mode === 'multi' &&
        currentRoom &&
        currentRoom.status === 'playing' &&
        local &&
        (forceSyncRef.current || now - lastPlayerSyncRef.current >= SYNC_INTERVAL_MS)
      ) {
        lastPlayerSyncRef.current = now;
        forceSyncRef.current = false;
        void syncLocalPlayerState(currentRoom.roomId, localUserId, {
          x: local.x,
          y: local.y,
          vx: local.vx,
          vy: local.vy,
          facing: local.facing,
          animState: local.animState,
          health: local.health,
          shield: local.shield,
          speedBoostSec: local.speedBoostSec,
          damageBoostSec: local.damageBoostSec,
          kills: local.kills,
          deaths: local.deaths,
          points: local.points,
          damageDealt: local.damageDealt,
          roundWins: local.roundWins,
          status: local.status,
          lastHitBy: local.lastHitBy,
          lastAttackSeq: local.lastAttackSeq,
          weaponCategory: local.weaponCategory,
          weaponRarity: local.weaponRarity,
          utilityRarity: local.utilityRarity,
          utilityCharges: local.utilityCharges,
        });
      }

      // Periodic Arena Coin Cache Generator + Coin Physics & Magnetic Collection
      if (roundPhaseRef.current === 'active' && roundCountdownRef.current <= 0) {
        coinSpawnTimerRef.current -= dt;
        if (coinSpawnTimerRef.current <= 0) {
          coinSpawnTimerRef.current = 6.8;
          if (coinsRef.current.length < 16) {
            const zcNow = zoneCenterRef.current;
            const spawnR = Math.min(zoneRadiusRef.current * 0.72, ARENA_RADIUS * 0.78);
            const ang = Math.random() * Math.PI * 2;
            const dist = Math.sqrt(Math.random()) * Math.max(70, spawnR);
            const cx = zcNow.x + Math.cos(ang) * dist;
            const cy = zcNow.y + Math.sin(ang) * dist;
            const isVault = Math.hypot(cx, cy) < RESOURCE_ZONE_RADIUS;
            spawnCoinBurst(
              cx,
              cy,
              1,
              isVault ? COIN_REWARDS.VAULT_COIN : COIN_REWARDS.CACHE_COIN,
              isVault ? 'vault' : 'cache'
            );
          }
        }
      }

      const arenaCoins = coinsRef.current;
      for (let i = arenaCoins.length - 1; i >= 0; i--) {
        const c = arenaCoins[i];
        c.life -= dt;
        if (c.life <= 0) {
          arenaCoins.splice(i, 1);
          continue;
        }
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vx *= Math.exp(-6.5 * dt);
        c.vy *= Math.exp(-6.5 * dt);

        if (local && local.status === 'alive') {
          const dx = local.x - c.x;
          const dy = local.y - c.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 110 && dist > 1) {
            const pull = (1 - dist / 110) * 520;
            c.x += (dx / dist) * pull * dt;
            c.y += (dy / dist) * pull * dt;
          }
          if (dist < 34) {
            audioEngine.playCoinPickup(c.value >= 20);
            spawnParticles(c.x, c.y, '#FACC15', c.value >= 20 ? 12 : 7, 130);
            spawnFloatingText(local.x, local.y - 34, `+${c.value} COINS`, '#FACC15');
            grantLocalProgress(c.value, XP_REWARDS.COIN_PICKUP);
            arenaCoins.splice(i, 1);
            continue;
          }
        }
      }

      // Update VFX pools
      const parts = particlesRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.exp(-5 * dt);
        p.vy *= Math.exp(-5 * dt);
        p.life -= dt;
        if (p.life <= 0) parts.splice(i, 1);
      }

      const arcs = swingArcsRef.current;
      for (let i = arcs.length - 1; i >= 0; i--) {
        arcs[i].life -= dt;
        if (arcs[i].life <= 0) arcs.splice(i, 1);
      }

      const beams = beamTrailsRef.current;
      for (let i = beams.length - 1; i >= 0; i--) {
        beams[i].life -= dt;
        if (beams[i].life <= 0) beams.splice(i, 1);
      }

      const waves = shockwavesRef.current;
      for (let i = waves.length - 1; i >= 0; i--) {
        waves[i].life -= dt;
        if (waves[i].life <= 0) waves.splice(i, 1);
      }

      const ghosts = ghostsRef.current;
      for (let i = ghosts.length - 1; i >= 0; i--) {
        ghosts[i].life -= dt;
        if (ghosts[i].life <= 0) ghosts.splice(i, 1);
      }

      const texts = floatingTextsRef.current;
      for (let i = texts.length - 1; i >= 0; i--) {
        texts[i].y -= 34 * dt;
        texts[i].life -= dt;
        if (texts[i].life <= 0) texts.splice(i, 1);
      }

      // Smooth camera tracking
      let camTarget = local;
      let spectatingName = '';
      if (!camTarget || camTarget.status === 'downed') {
        const aliveTeammate =
          gameMode === 'tdm' && local
            ? Array.from(fightersRef.current.values()).find(
                (f) => f.status === 'alive' && f.team === local.team
              )
            : undefined;
        const aliveOther =
          aliveTeammate ||
          Array.from(fightersRef.current.values()).find((f) => f.status === 'alive');
        if (aliveOther) {
          camTarget = aliveOther;
          spectatingName = aliveOther.displayName;
        }
      }
      if (camTarget) {
        const camAlpha = 1 - Math.exp(-8.5 * dt);
        cameraRef.current.x += (camTarget.x - cameraRef.current.x) * camAlpha;
        cameraRef.current.y += (camTarget.y - cameraRef.current.y) * camAlpha;
      }
      cameraRef.current.shake = Math.max(0, cameraRef.current.shake - dt * 28);

      // Throttled HUD state sync (~10 Hz)
      hudTimer += dt;
      if (hudTimer >= 0.1) {
        hudTimer = 0;
        const nowMs = performance.now();
        killFeedRef.current = killFeedRef.current.filter((e) => e.expiresAt > nowMs);

        const allFighters = Array.from(fightersRef.current.values());
        const aliveFighters = allFighters.filter((f) => f.status === 'alive');
        const avatarScores = buildAvatarScoreEntries();
        const localRank = Math.max(
          1,
          avatarScores.findIndex((a) => a.id === localUserId) + 1
        );

        const localTarget =
          roundPhaseRef.current === 'active' && local && local.status === 'alive'
            ? findBestTargetFor(local)
            : null;
        const localSpec = local
          ? getWeaponSpec(local.weaponCategory, local.weaponRarity, getGunLevelFor(local))
          : getWeaponSpec('close', 'common', progressionRef.current.gunLevels.close);

        const activePickups = getCurrentRoundPickups();
        let swapPrompt: SwapPrompt | null = null;
        if (roundPhaseRef.current === 'active' && local && local.status === 'alive') {
          for (const pk of activePickups) {
            if (!pk.active || !isWeaponPickup(pk.type)) continue;
            if (Math.hypot(pk.x - local.x, pk.y - local.y) < PICKUP_RANGE + 14) {
              if (pk.type !== local.weaponCategory || pk.rarity !== local.weaponRarity) {
                const info = WEAPON_CATALOG[pk.type];
                swapPrompt = {
                  pickupId: pk.pickupId,
                  label: info.name,
                  rarity: pk.rarity,
                  role: info.roleLabel,
                };
                break;
              }
            }
          }
        }

        const zc = zoneCenterRef.current;
        const zr = zoneRadiusRef.current;
        const inStorm = local
          ? local.status === 'alive' && Math.hypot(local.x - zc.x, local.y - zc.y) > zr
          : false;
        const isSnared = local
          ? getSnareSlowMultiplier(local.id, local.team, local.x, local.y, hazardsRef.current) < 0.99
          : false;
        const inSmoke = local ? isInsideSmoke(local.x, local.y, hazardsRef.current) : false;
        const localCover =
          local && local.status === 'alive'
            ? getCoverInfo(local.x, local.y, obstaclesRef.current, 24)
            : null;
        const inCover = Boolean(localCover);
        const canSnapCover =
          !inCover &&
          Boolean(
            local &&
              local.status === 'alive' &&
              getCoverInfo(local.x, local.y, obstaclesRef.current, 68)
          );
        const rareVaultRemaining = activePickups.filter(
          (pk) => pk.active && pk.rarity === 'rare'
        ).length;
        const uSpec =
          local && local.utilityRarity !== 'none' ? UTILITY_SPEC[local.utilityRarity] : null;
        const roundTimeRemaining =
          mode === 'multi' && currentRoom && !isHost
            ? currentRoom.timeRemainingSec
            : Math.max(0, roundDurationRef.current - roundElapsedRef.current);
        const remainingRoundsAfterThis = Math.max(0, totalRoundsRef.current - currentRoundRef.current);
        const matchTimeRemaining =
          roundTimeRemaining + remainingRoundsAfterThis * roundDurationRef.current;
        const resurgenceCutoff = roundDurationRef.current * SURVIVAL_RESURGENCE_FRAC;
        const survivalResurgenceActive =
          gameMode === 'survival' && roundElapsedRef.current < resurgenceCutoff;
        const survivalResurgenceLeftSec = Math.max(0, resurgenceCutoff - roundElapsedRef.current);

        if (hypeBannerRef.current && hypeBannerRef.current.expiresAt <= nowMs) {
          hypeBannerRef.current = null;
        }

        setHud({
          health: Math.ceil(local?.health ?? 0),
          shield: Math.ceil(local?.shield ?? 0),
          kills: local?.kills ?? 0,
          deaths: local?.deaths ?? 0,
          points: Math.round(local?.points ?? 0),
          localTeam: local?.team ?? 'none',
          localRank,
          aliveCount: aliveFighters.length,
          totalCount: allFighters.length,
          currentRound: currentRoundRef.current,
          totalRounds: totalRoundsRef.current,
          roundPhase: roundPhaseRef.current,
          roundCountdownSec: roundCountdownRef.current,
          roundTimeRemainingSec: roundTimeRemaining,
          matchTimeRemainingSec: matchTimeRemaining,
          intermissionLeftSec: intermissionLeftRef.current,
          totalElapsedSec: totalElapsedRef.current,
          survivalResurgenceActive,
          survivalResurgenceLeftSec,
          redScore: redScoreRef.current,
          blueScore: blueScoreRef.current,
          redRoundsWon: redRoundsWonRef.current,
          blueRoundsWon: blueRoundsWonRef.current,
          phaseLabel: phaseLabelRef.current,
          currentZone: local ? getMapZoneAt(local.x, local.y) : 'open',
          inStorm,
          isSnared,
          inSmoke,
          inCover,
          canSnapCover,
          speedBoostSec: local?.speedBoostSec ?? 0,
          damageBoostSec: local?.damageBoostSec ?? 0,
          spawnShieldSec: local?.spawnShieldTimer ?? 0,
          respawnTimerSec: local?.respawnTimer ?? 0,
          dashReadyPct: local ? Math.max(0, Math.min(1, 1 - local.dashCooldown / 2.6)) : 1,
          overdrivePct: Math.round(overdriveChargeRef.current),
          localStreak: streaksRef.current.get(localUserId) ?? 0,
          weaponCategory: local?.weaponCategory ?? 'close',
          weaponRarity: local?.weaponRarity ?? 'common',
          weaponReadyPct: local
            ? Math.max(
                0,
                Math.min(1, 1 - local.attackCooldown / Math.max(localSpec.cooldownSec, 0.1))
              )
            : 1,
          utilityRarity: local?.utilityRarity ?? 'none',
          utilityCharges: local?.utilityCharges ?? 0,
          utilityReadyPct:
            local && uSpec
              ? Math.max(0, Math.min(1, 1 - local.utilityCooldown / uSpec.cooldownSec))
              : 1,
          hasTargetInRange: Boolean(localTarget),
          rareVaultRemaining,
          swapPrompt,
          isDowned: local?.status === 'downed',
          spectatingName,
          hypeBanner: hypeBannerRef.current,
          killFeed: [...killFeedRef.current],
          lastRoundResult: lastRoundResultRef.current,
          avatarScores,
          coinsEarned: sessionCoinsRef.current,
          totalCoins: progressionRef.current.coins + sessionCoinsRef.current,
          playerLevel: liveLevelRef.current,
          playerXp: liveXpRef.current,
          playerNextLevelXp: getXpForNextLevel(liveLevelRef.current),
          weaponUpgradeLevel: local
            ? progressionRef.current.gunLevels[local.weaponCategory]
            : progressionRef.current.gunLevels.close,
        });
      }

      setRenderTick((t) => (t + 1) & 0xffff);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gameMode, localUserId, onMatchComplete]);

  // Aspect-ratio-aware SVG camera math (balances field of view across phone portrait/landscape, tablet, and laptop)
  const localFighter = fightersRef.current.get(localUserId);
  const shortSide = Math.max(240, Math.min(viewport.w, viewport.h));
  const longSide = Math.max(320, Math.max(viewport.w, viewport.h));
  const targetShortWorld = shortSide < 460 ? 640 : shortSide < 780 ? 700 : 740;
  const fitByShort = shortSide / targetShortWorld;
  const fitByLong = longSide / 1380;
  const baseZoom = Math.max(0.48, Math.min(1.12, Math.min(fitByShort, fitByLong * 1.18)));
  const zoom = localFighter?.weaponCategory === 'long' ? baseZoom * 0.88 : baseZoom;
  const viewW = viewport.w / zoom;
  const viewH = viewport.h / zoom;
  const isShortFrame = viewport.h < 500;
  const shakeX =
    cameraRef.current.shake > 0 ? (Math.random() - 0.5) * cameraRef.current.shake * 2 : 0;
  const shakeY =
    cameraRef.current.shake > 0 ? (Math.random() - 0.5) * cameraRef.current.shake * 2 : 0;
  const viewMinX = cameraRef.current.x - viewW / 2 + shakeX;
  const viewMinY = cameraRef.current.y - viewH / 2 + shakeY;

  const fightersSorted = Array.from(fightersRef.current.values()).sort((a, b) => {
    if (a.status === 'downed' && b.status !== 'downed') return -1;
    if (a.status !== 'downed' && b.status === 'downed') return 1;
    return a.y - b.y;
  });
  const visiblePickups = getCurrentRoundPickups();
  const localSpec = localFighter
    ? getWeaponSpec(
        localFighter.weaponCategory,
        localFighter.weaponRarity,
        progressionRef.current.gunLevels[localFighter.weaponCategory]
      )
    : getWeaponSpec('close', 'common', progressionRef.current.gunLevels.close);
  const zc = zoneCenterRef.current;
  const zr = zoneRadiusRef.current;
  const ztr = zoneTargetRadiusRef.current;
  const nowEpoch = Date.now();
  const zoneMeta = MAP_ZONE_META[hud.currentZone];
  const equippedWeaponMeta = WEAPON_CATALOG[hud.weaponCategory];
  const equippedRarityMeta = RARITY_META[hud.weaponRarity];
  const localActiveCover =
    localFighter && localFighter.status === 'alive'
      ? getCoverInfo(localFighter.x, localFighter.y, obstaclesRef.current, 24)
      : null;
  const localNearbyCover =
    !localActiveCover && localFighter && localFighter.status === 'alive'
      ? getCoverInfo(localFighter.x, localFighter.y, obstaclesRef.current, 68)
      : null;

  // Pointer click-to-attack / right-click-dash on desktop arena SVG
  const handleArenaPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (paused || mobileControlsEnabled || e.pointerType === 'touch' || hud.roundPhase !== 'active') {
      return;
    }
    if (e.button === 2) {
      justPressedDashRef.current = true;
      return;
    }
    if (e.button === 0) {
      justPressedAttackRef.current = true;
    }
  };

  // Stable callbacks for multi-touch MobileController
  const handleMobileMoveVector = useCallback((x: number, y: number) => {
    joyVecRef.current = { x, y };
  }, []);

  const handleMobileFireChange = useCallback((firing: boolean) => {
    isHoldingAttackRef.current = firing;
    if (firing) {
      justPressedAttackRef.current = true;
    }
  }, []);

  const handleMobileDash = useCallback(() => {
    justPressedDashRef.current = true;
  }, []);

  const handleMobileCover = useCallback(() => {
    justPressedCoverRef.current = true;
  }, []);

  const handleMobileUtility = useCallback(() => {
    justPressedUtilityRef.current = true;
  }, []);

  const handleMobileNova = useCallback(() => {
    justPressedNovaRef.current = true;
  }, []);

  const handleMobileSwap = useCallback(() => {
    justPressedSwapRef.current = true;
  }, []);

  const handleToggleAutoFire = useCallback(() => {
    setAutoFireEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('los_auto_fire_v1', next ? 'on' : 'off');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const copyRoomCode = () => {
    if (!room) return;
    navigator.clipboard?.writeText(room.roomId).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1600);
  };

  const pulseWave = (Math.sin(totalElapsedRef.current * 4.5) + 1) * 0.5;

  return (
    <div
      ref={arenaContainerRef}
      className="relative h-full w-full overflow-hidden bg-[#0E131A] touch-none select-none"
    >
      {/* Isolated Full-Viewport SVG Game Canvas */}
      <svg
        className="block h-full w-full cursor-crosshair select-none"
        viewBox={`${viewMinX} ${viewMinY} ${viewW} ${viewH}`}
        onPointerDown={handleArenaPointerDown}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label="LastOneStanding 4-Round Arena"
      >
        <defs>
          <pattern id="concrete-floor" width="280" height="280" patternUnits="userSpaceOnUse">
            <rect width="280" height="280" fill="#1E2530" />
            <image
              href={CONCRETE_TEXTURE_URL}
              width="280"
              height="280"
              preserveAspectRatio="xMidYMid slice"
              opacity="0.7"
            />
          </pattern>

          <pattern
            id="storm-hatch"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="24" stroke="#EF4444" strokeWidth="6" opacity="0.16" />
          </pattern>

          <radialGradient id="rare-gold-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FACC15" stopOpacity="0.6" />
            <stop offset="55%" stopColor="#F59E0B" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="smoke-shroud-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#CBD5E1" stopOpacity="0.72" />
            <stop offset="68%" stopColor="#64748B" stopOpacity="0.56" />
            <stop offset="100%" stopColor="#334155" stopOpacity="0.08" />
          </radialGradient>

          <mask id="storm-zone-mask">
            <rect x={-1800} y={-1800} width={3600} height={3600} fill="#FFFFFF" />
            <circle cx={zc.x} cy={zc.y} r={Math.max(0, zr)} fill="#000000" />
          </mask>
        </defs>

        <rect x={-1800} y={-1800} width={3600} height={3600} fill="#0D1218" />

        <circle
          cx={0}
          cy={0}
          r={ARENA_RADIUS}
          fill="url(#concrete-floor)"
          stroke="#334155"
          strokeWidth="12"
        />

        {/* 4 Architectural Map Zones */}
        <path d={DENSE_SECTOR_PATH} fill="rgba(234, 88, 12, 0.085)" />
        <path d={OPEN_SECTOR_PATH} fill="rgba(56, 189, 248, 0.065)" />
        <path d={FLANK_SECTOR_PATH} fill="rgba(20, 184, 166, 0.075)" />

        <g fill="none" opacity="0.24">
          <path
            d={describeSectorPath(370, 560, -88, 43)}
            stroke="#7DD3FC"
            strokeWidth="1.4"
            strokeDasharray="10 8"
          />
          <path
            d={describeSectorPath(290, 520, 137, 268)}
            stroke="#FB923C"
            strokeWidth="1.5"
            strokeDasharray="6 6"
          />
          {[45, 135, 270].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={Math.cos(rad) * RESOURCE_ZONE_RADIUS}
                y1={Math.sin(rad) * RESOURCE_ZONE_RADIUS}
                x2={Math.cos(rad) * ARENA_RADIUS}
                y2={Math.sin(rad) * ARENA_RADIUS}
                stroke="#94A3B8"
                strokeWidth="2"
                strokeDasharray="10 10"
              />
            );
          })}
        </g>

        {/* Center Resource Zone: Sundial Vault */}
        <g>
          <circle
            cx={0}
            cy={0}
            r={RESOURCE_ZONE_RADIUS}
            fill="rgba(250, 204, 21, 0.08)"
            stroke="#FACC15"
            strokeOpacity="0.45"
            strokeWidth="2.5"
            strokeDasharray="12 8"
          />
          <circle
            cx={0}
            cy={0}
            r={RESOURCE_ZONE_RADIUS * 0.56}
            fill="rgba(250, 204, 21, 0.06)"
            stroke="#F59E0B"
            strokeOpacity="0.35"
            strokeWidth="1.6"
          />
          <g stroke="#FACC15" strokeWidth="1.2" opacity="0.22">
            <line x1={-RESOURCE_ZONE_RADIUS} y1={0} x2={RESOURCE_ZONE_RADIUS} y2={0} />
            <line x1={0} y1={-RESOURCE_ZONE_RADIUS} x2={0} y2={RESOURCE_ZONE_RADIUS} />
          </g>
        </g>

        {/* Engraved Floor Zone Labels */}
        <g
          fontFamily="Barlow Condensed, sans-serif"
          fontWeight="800"
          letterSpacing="3"
          textAnchor="middle"
          pointerEvents="none"
        >
          <text x={0} y={-122} fontSize="18" fill="#FACC15" opacity="0.46">
            SUNDIAL VAULT · RARE GOLD (+50 PTS)
          </text>
          <text x={-380} y={-165} fontSize="22" fill="#FB923C" opacity="0.34">
            INSTRUMENT MAZE
          </text>
          <text x={-380} y={-143} fontSize="12" fill="#FDBA74" opacity="0.32">
            DENSE · CLOSE-RANGE & HIGH LOOT
          </text>
          <text x={425} y={-60} fontSize="22" fill="#7DD3FC" opacity="0.34">
            OUTER COLONNADE
          </text>
          <text x={425} y={-38} fontSize="12" fill="#BAE6FD" opacity="0.32">
            OPEN · LONG-RANGE SIGHTLINES
          </text>
          <text x={0} y={390} fontSize="21" fill="#5EEAD4" opacity="0.34">
            CROSSWAY BAZAAR
          </text>
          <text x={0} y={412} fontSize="12" fill="#99F6E4" opacity="0.32">
            FLANK SHORTCUT · MID & UTILITY
          </text>
        </g>

        {/* Next Safe-Zone Preview Ring */}
        <circle
          cx={zc.x}
          cy={zc.y}
          r={Math.max(0, ztr)}
          fill="none"
          stroke="#F8FAFC"
          strokeWidth="2"
          strokeDasharray="8 8"
          opacity="0.34"
        />

        {/* Local Player Dynamic Weapon Range Ring */}
        {localFighter && localFighter.status === 'alive' && (
          <circle
            cx={localFighter.x}
            cy={localFighter.y}
            r={localSpec.range}
            fill={hud.hasTargetInRange ? 'rgba(245, 158, 11, 0.055)' : 'none'}
            stroke={
              hud.hasTargetInRange ? '#F59E0B' : RARITY_META[localFighter.weaponRarity].color
            }
            strokeWidth={hud.hasTargetInRange ? 2.2 : 1.25}
            strokeDasharray={localFighter.weaponCategory === 'long' ? '12 8' : '7 6'}
            opacity={hud.hasTargetInRange ? 0.72 : 0.25}
          />
        )}

        {/* Zone-Themed Obstacles (with Tactical Block Cover Highlight) */}
        {obstaclesRef.current.map((obs) => {
          const isDense = obs.zone === 'dense';
          const isResource = obs.zone === 'resource';
          const isOpen = obs.zone === 'open';
          const isActiveCoverBlock = localActiveCover?.obstacle.id === obs.id;
          const isNearbyCoverBlock = localNearbyCover?.obstacle.id === obs.id;

          if ((obs.kind === 'crate' || obs.kind === 'wall') && obs.w && obs.h) {
            const fill = isDense ? '#3D302A' : '#2C3644';
            const stroke = isActiveCoverBlock
              ? '#10B981'
              : isNearbyCoverBlock
                ? '#34D399'
                : isDense
                  ? '#9A5B3E'
                  : '#475569';
            const detail = isDense ? '#2A201B' : '#1E293B';
            return (
              <g key={obs.id} transform={`translate(${obs.x}, ${obs.y})`}>
                {isActiveCoverBlock && (
                  <rect
                    x={-obs.w / 2 - 5}
                    y={-obs.h / 2 - 5}
                    width={obs.w + 10}
                    height={obs.h + 10}
                    rx="8"
                    fill="rgba(16, 185, 129, 0.14)"
                    stroke="#10B981"
                    strokeWidth="2.4"
                    opacity={0.72 + pulseWave * 0.28}
                    pointerEvents="none"
                  />
                )}
                {isNearbyCoverBlock && (
                  <rect
                    x={-obs.w / 2 - 4}
                    y={-obs.h / 2 - 4}
                    width={obs.w + 8}
                    height={obs.h + 8}
                    rx="7"
                    fill="none"
                    stroke="#34D399"
                    strokeWidth="1.6"
                    strokeDasharray="6 5"
                    opacity="0.58"
                    pointerEvents="none"
                  />
                )}
                <rect
                  x={-obs.w / 2 + 5}
                  y={-obs.h / 2 + 7}
                  width={obs.w}
                  height={obs.h}
                  rx="5"
                  fill="#06090E"
                  opacity="0.52"
                />
                <rect
                  x={-obs.w / 2}
                  y={-obs.h / 2}
                  width={obs.w}
                  height={obs.h}
                  rx="5"
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isActiveCoverBlock ? 3.2 : 2.5}
                />
                {obs.kind === 'wall' ? (
                  <rect
                    x={-obs.w / 2 + 6}
                    y={-obs.h / 2 + 6}
                    width={obs.w - 12}
                    height={obs.h - 12}
                    rx="2"
                    fill="none"
                    stroke={isActiveCoverBlock ? '#10B981' : detail}
                    strokeOpacity={isActiveCoverBlock ? 0.55 : 1}
                    strokeWidth="2"
                  />
                ) : (
                  <>
                    <line
                      x1={-obs.w / 2 + 8}
                      y1={-obs.h / 2 + 8}
                      x2={obs.w / 2 - 8}
                      y2={obs.h / 2 - 8}
                      stroke={detail}
                      strokeWidth="2"
                    />
                    <line
                      x1={obs.w / 2 - 8}
                      y1={-obs.h / 2 + 8}
                      x2={-obs.w / 2 + 8}
                      y2={obs.h / 2 - 8}
                      stroke={detail}
                      strokeWidth="2"
                    />
                  </>
                )}
              </g>
            );
          }

          const pFill = isResource
            ? '#3B3424'
            : isOpen
              ? '#364454'
              : isDense
                ? '#42332C'
                : '#2A3340';
          const pStroke = isActiveCoverBlock
            ? '#10B981'
            : isNearbyCoverBlock
              ? '#34D399'
              : isResource
                ? '#D97706'
                : isOpen
                  ? '#7DD3FC'
                  : isDense
                    ? '#C26D45'
                    : '#475569';
          const pCore = isResource
            ? '#574A2E'
            : isOpen
              ? '#4B5E73'
              : isDense
                ? '#594238'
                : '#364152';

          return (
            <g key={obs.id} transform={`translate(${obs.x}, ${obs.y})`}>
              {isActiveCoverBlock && (
                <circle
                  cx="0"
                  cy="0"
                  r={obs.radius + 6}
                  fill="rgba(16, 185, 129, 0.14)"
                  stroke="#10B981"
                  strokeWidth="2.4"
                  opacity={0.72 + pulseWave * 0.28}
                  pointerEvents="none"
                />
              )}
              {isNearbyCoverBlock && (
                <circle
                  cx="0"
                  cy="0"
                  r={obs.radius + 5}
                  fill="none"
                  stroke="#34D399"
                  strokeWidth="1.6"
                  strokeDasharray="6 5"
                  opacity="0.58"
                  pointerEvents="none"
                />
              )}
              <circle cx="5" cy="7" r={obs.radius} fill="#06090E" opacity="0.52" />
              <circle
                cx="0"
                cy="0"
                r={obs.radius}
                fill={pFill}
                stroke={pStroke}
                strokeWidth={isActiveCoverBlock ? 3.4 : 2.8}
              />
              <circle cx="0" cy="0" r={obs.radius * 0.58} fill={pCore} />
            </g>
          );
        })}

        {/* 4 Kinetic Boost / Jump Pads at Zone Junctions */}
        {jumpPadsRef.current.map((pad) => {
          const ready = pad.cooldown <= 0;
          return (
            <g key={pad.id} transform={`translate(${pad.x}, ${pad.y})`} pointerEvents="none">
              <circle
                cx="0"
                cy="0"
                r={ready ? 25 + pulseWave * 5 : 22}
                fill={ready ? 'rgba(34, 211, 238, 0.14)' : 'rgba(51, 65, 85, 0.25)'}
                stroke={ready ? '#22D3EE' : '#475569'}
                strokeWidth={ready ? 2.4 : 1.5}
                strokeDasharray={ready ? '6 4' : undefined}
                opacity={ready ? 0.9 : 0.45}
              />
              <circle
                cx="0"
                cy="0"
                r="14"
                fill="#0F172A"
                stroke={ready ? '#67E8F9' : '#475569'}
                strokeWidth="1.8"
              />
              <path
                d="M -6,3 L 0,-5 L 6,3 M -4,7 L 0,1 L 4,7"
                fill="none"
                stroke={ready ? '#22D3EE' : '#64748B'}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {/* Active Floor Pickups for Current Round */}
        {visiblePickups.map((pk) => {
          if (!pk.active) return null;
          const bob = Math.sin(totalElapsedRef.current * 4.2 + pk.x * 0.05) * 3.5;
          const isRare = pk.rarity === 'rare';
          const isWep = isWeaponPickup(pk.type);
          const isUtil = pk.type === 'utility';
          const rarityColor = RARITY_META[pk.rarity].color;
          const accent =
            isWep || isUtil
              ? rarityColor
              : pk.type === 'medkit'
                ? '#10B981'
                : pk.type === 'shield'
                  ? '#38BDF8'
                  : pk.type === 'speed'
                    ? '#F59E0B'
                    : '#F97316';

          const nearLocal =
            localFighter && Math.hypot(pk.x - localFighter.x, pk.y - localFighter.y) < 120;

          return (
            <g key={pk.pickupId} transform={`translate(${pk.x}, ${pk.y})`}>
              {isRare && (
                <g pointerEvents="none">
                  <circle cx="0" cy="0" r="48" fill="url(#rare-gold-glow)" />
                  <circle
                    cx="0"
                    cy="0"
                    r={22 + pulseWave * 28}
                    fill="none"
                    stroke="#FACC15"
                    strokeWidth="2.2"
                    opacity={0.78 - pulseWave * 0.65}
                  />
                  <line
                    x1="-26"
                    y1="0"
                    x2="26"
                    y2="0"
                    stroke="#FDE047"
                    strokeWidth="1.2"
                    opacity="0.45"
                  />
                  <line
                    x1="0"
                    y1="-26"
                    x2="0"
                    y2="26"
                    stroke="#FDE047"
                    strokeWidth="1.2"
                    opacity="0.45"
                  />
                </g>
              )}

              <ellipse
                cx="0"
                cy="15"
                rx={isRare ? 16 : 12}
                ry="4.5"
                fill="#06090E"
                opacity="0.5"
              />

              <g transform={`translate(0, ${bob})`}>
                <circle
                  cx="0"
                  cy="0"
                  r={isRare ? 18 : isWep || isUtil ? 15.5 : 13.5}
                  fill="#0F172A"
                  stroke={accent}
                  strokeWidth={isRare ? 3.2 : 2.4}
                />

                {pk.type === 'close' && (
                  <g transform="translate(-14, -5.5) scale(0.128)" pointerEvents="none">
                    <WeaponGraphicSvg
                      category="close"
                      upgradeLevel={progression.gunLevels.close}
                      rarity={pk.rarity}
                      width={220}
                      height={84}
                      className=""
                      compact
                    />
                  </g>
                )}
                {pk.type === 'mid' && (
                  <g transform="translate(-14, -5.5) scale(0.128)" pointerEvents="none">
                    <WeaponGraphicSvg
                      category="mid"
                      upgradeLevel={progression.gunLevels.mid}
                      rarity={pk.rarity}
                      width={220}
                      height={84}
                      className=""
                      compact
                    />
                  </g>
                )}
                {pk.type === 'long' && (
                  <g transform="translate(-15, -5.5) scale(0.134)" pointerEvents="none">
                    <WeaponGraphicSvg
                      category="long"
                      upgradeLevel={progression.gunLevels.long}
                      rarity={pk.rarity}
                      width={220}
                      height={84}
                      className=""
                      compact
                    />
                  </g>
                )}
                {pk.type === 'utility' && (
                  <g fill="none" stroke={accent} strokeWidth="2">
                    <circle cx="-3" cy="1" r="4.5" fill={accent} fillOpacity="0.28" />
                    <circle cx="3.5" cy="-1.5" r="4" fill={accent} fillOpacity="0.28" />
                    <circle cx="0" cy="-4.5" r="3" fill={accent} fillOpacity="0.35" />
                  </g>
                )}

                {pk.type === 'medkit' && (
                  <path
                    d="M -5.5,0 H 5.5 M 0,-5.5 V 5.5"
                    stroke="#10B981"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                )}
                {pk.type === 'shield' && (
                  <path
                    d="M 0,-7 L 6,-4 V 1 C 6,5 0,8 0,8 C 0,8 -6,5 -6,1 V -4 Z"
                    fill="#38BDF8"
                  />
                )}
                {pk.type === 'speed' && (
                  <polygon points="1,-7 -5,1 0,1 -1,7 5,-1 0,-1" fill="#F59E0B" />
                )}
                {pk.type === 'power' && (
                  <polygon
                    points="0,-7.5 2.2,-2.2 7.5,-2.2 3.2,1.2 4.8,6.8 0,3.6 -4.8,6.8 -3.2,1.2 -7.5,-2.2 -2.2,-2.2"
                    fill="#F97316"
                  />
                )}
              </g>

              {(isRare || (nearLocal && (isWep || isUtil))) && (
                <text
                  x="0"
                  y={isRare ? -25 : -22}
                  textAnchor="middle"
                  fill={accent}
                  stroke="#090D14"
                  strokeWidth="3.2"
                  paintOrder="stroke"
                  fontSize={isRare ? '11.5' : '10'}
                  fontWeight="800"
                  fontFamily="Barlow Condensed, sans-serif"
                  letterSpacing="0.8"
                >
                  {isRare ? '★ ' : ''}
                  {isWeaponPickup(pk.type)
                    ? WEAPON_CATALOG[pk.type].name.toUpperCase()
                    : isUtil
                      ? 'SHROUD SNARE'
                      : pk.type.toUpperCase()}
                </text>
              )}
            </g>
          );
        })}

        {/* Collectible Spinning Arena Gold Coins */}
        {coinsRef.current.map((coin) => {
          const spin = Math.cos(totalElapsedRef.current * 5.2 + coin.bobPhase);
          const scaleX = Math.max(0.28, Math.abs(spin));
          const bobY = Math.sin(totalElapsedRef.current * 4.4 + coin.bobPhase) * 3;
          const isVault = coin.kind === 'vault';
          const r = isVault ? 11.5 : coin.kind === 'cache' ? 9.5 : 8;
          const fade = coin.life < 3 ? Math.max(0.25, coin.life / 3) : 1;
          return (
            <g key={coin.id} transform={`translate(${coin.x}, ${coin.y})`} opacity={fade} pointerEvents="none">
              {isVault && (
                <circle cx="0" cy="0" r="24" fill="url(#rare-gold-glow)" opacity="0.7" />
              )}
              <ellipse cx="0" cy="11" rx={r * 0.85} ry="3.2" fill="#06090E" opacity="0.45" />
              <g transform={`translate(0, ${bobY}) scale(${scaleX}, 1)`}>
                <circle cx="0" cy="0" r={r} fill="#D97706" stroke="#78350F" strokeWidth="1.6" />
                <circle cx="0" cy="0" r={r * 0.76} fill="#FACC15" stroke="#FEF08A" strokeWidth="1" />
                <polygon
                  points={`0,${-r * 0.48} ${r * 0.16},${-r * 0.12} ${r * 0.5},${-r * 0.08} ${r * 0.22},${r * 0.16} ${r * 0.3},${r * 0.48} 0,${r * 0.28} ${-r * 0.3},${r * 0.48} ${-r * 0.22},${r * 0.16} ${-r * 0.5},${-r * 0.08} ${-r * 0.16},${-r * 0.12}`}
                  fill="#B45309"
                />
              </g>
            </g>
          );
        })}

        {/* Melee Swing Slash Arcs */}
        {swingArcsRef.current.map((arc) => {
          const pct = arc.life / arc.maxLife;
          const deg = (arc.angle * 180) / Math.PI;
          const rad = arc.radius;
          return (
            <g
              key={arc.id}
              transform={`translate(${arc.x}, ${arc.y}) rotate(${deg})`}
              opacity={pct * 0.92}
            >
              <path
                d={`M ${rad * 0.45},${-rad * 0.72} A ${rad},${rad} 0 0 1 ${rad * 0.45},${rad * 0.72}`}
                fill="none"
                stroke={arc.color}
                strokeWidth={arc.powered ? 7 : 4.8}
                strokeLinecap="round"
              />
            </g>
          );
        })}

        {/* Ranged Tracer Beams */}
        {beamTrailsRef.current.map((beam) => {
          const pct = beam.life / beam.maxLife;
          return (
            <g key={beam.id} opacity={pct}>
              <line
                x1={beam.x1}
                y1={beam.y1}
                x2={beam.x2}
                y2={beam.y2}
                stroke={beam.color}
                strokeWidth={beam.width * 2.1}
                strokeLinecap="round"
                opacity="0.32"
              />
              <line
                x1={beam.x1}
                y1={beam.y1}
                x2={beam.x2}
                y2={beam.y2}
                stroke="#FFFFFF"
                strokeWidth={beam.width * 0.75}
                strokeLinecap="round"
                strokeDasharray={beam.kind === 'mid' ? '14 10' : undefined}
              />
            </g>
          );
        })}

        {/* Dash & Kinetic Launch Ghost Afterimages */}
        {ghostsRef.current.map((g) => {
          const pct = g.life / g.maxLife;
          return (
            <g key={g.id} transform={`translate(${g.x}, ${g.y})`} opacity={pct * 0.42} pointerEvents="none">
              <circle cx="0" cy="-19" r="7" fill={g.color} />
              <line x1="0" y1="-11" x2="0" y2="7" stroke={g.color} strokeWidth="4" strokeLinecap="round" />
              <line x1="-8" y1="-2" x2="8" y2="-2" stroke={g.color} strokeWidth="3.2" strokeLinecap="round" />
              <line x1="0" y1="7" x2="-7" y2="18" stroke={g.color} strokeWidth="3.2" strokeLinecap="round" />
              <line x1="0" y1="7" x2="7" y2="18" stroke={g.color} strokeWidth="3.2" strokeLinecap="round" />
            </g>
          );
        })}

        {/* Expanding Impact, Jump-Pad & Overdrive Shockwave Rings */}
        {shockwavesRef.current.map((w) => {
          const progress = 1 - w.life / w.maxLife;
          const r = Math.max(8, progress * w.maxRadius);
          return (
            <circle
              key={w.id}
              cx={w.x}
              cy={w.y}
              r={r}
              fill="none"
              stroke={w.color}
              strokeWidth={Math.max(1, w.strokeWidth * (1 - progress * 0.7))}
              opacity={Math.max(0, (1 - progress) * 0.9)}
              pointerEvents="none"
            />
          );
        })}

        {/* Procedurally Animated Stick Figures */}
        {fightersSorted.map((f) => {
          const isStale =
            mode === 'multi' && !f.isLocal && nowEpoch - f.lastSeenMs > STALE_PLAYER_MS;
          const isFriendly = localFighter ? areTeammates(localFighter, f) : false;
          const targetInRange =
            localFighter &&
            localFighter.status === 'alive' &&
            !f.isLocal &&
            !isFriendly &&
            f.status === 'alive' &&
            f.spawnShieldTimer <= 0 &&
            Math.hypot(f.x - localFighter.x, f.y - localFighter.y) <= localSpec.range + 8 &&
            hasObstacleLineOfSight(
              localFighter.x,
              localFighter.y,
              f.x,
              f.y,
              obstaclesRef.current
            ) &&
            (!localSpec.requiresLos ||
              hasLineOfSight(
                localFighter.x,
                localFighter.y,
                f.x,
                f.y,
                obstaclesRef.current,
                hazardsRef.current
              ));

          const fighterInSmoke = isInsideSmoke(f.x, f.y, hazardsRef.current);
          const distToLocal = localFighter
            ? Math.hypot(f.x - localFighter.x, f.y - localFighter.y)
            : 0;
          const hiddenFromLocal =
            !f.isLocal && !isFriendly && f.status === 'alive' && fighterInSmoke && distToLocal > 110;
          if (hiddenFromLocal) return null;

          const fighterSnared =
            f.status === 'alive' &&
            getSnareSlowMultiplier(f.id, f.team, f.x, f.y, hazardsRef.current) < 0.99;
          const fighterInCover =
            f.status === 'alive' &&
            Boolean(getCoverInfo(f.x, f.y, obstaclesRef.current, 24));

          return (
            <g key={f.id}>
              {targetInRange && (
                <ellipse
                  cx={f.x}
                  cy={f.y + 19}
                  rx="23"
                  ry="8.5"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2.5"
                />
              )}
              <StickFigureSvg
                x={f.x}
                y={f.y}
                color={f.color}
                accessory={f.accessory}
                team={f.team}
                animState={f.animState}
                animPhase={f.animPhase}
                facing={f.facing}
                health={f.health}
                shield={f.shield}
                displayName={f.displayName}
                isLocal={f.isLocal}
                hitFlash={f.hitFlashTimer > 0}
                speedBoost={f.speedBoostSec > 0}
                damageBoost={f.damageBoostSec > 0}
                snared={fighterSnared}
                concealed={fighterInSmoke}
                inCover={fighterInCover}
                spawnShield={f.spawnShieldTimer > 0}
                weaponCategory={f.weaponCategory}
                weaponRarity={f.weaponRarity}
                weaponLevel={f.isLocal ? progression.gunLevels[f.weaponCategory] : 1}
                streak={streaksRef.current.get(f.id) ?? 0}
                overdriveReady={f.isLocal && overdriveChargeRef.current >= 100}
                stale={isStale}
              />
            </g>
          );
        })}

        {/* Active Area Utility Hazards */}
        {hazardsRef.current.map((hz) => {
          const fade = Math.min(1, hz.life / 1.1);
          const isRare = hz.rarity === 'rare';
          const ringColor = isRare ? '#FACC15' : '#C084FC';
          return (
            <g
              key={hz.id}
              transform={`translate(${hz.x}, ${hz.y})`}
              opacity={fade}
              pointerEvents="none"
            >
              <circle
                cx="0"
                cy="0"
                r={hz.radius}
                fill="url(#smoke-shroud-grad)"
                stroke={ringColor}
                strokeWidth="2.5"
                strokeDasharray="10 7"
              />
              <circle
                cx={-hz.radius * 0.28}
                cy={-hz.radius * 0.18}
                r={hz.radius * 0.45}
                fill="#94A3B8"
                opacity="0.28"
              />
              <circle
                cx={hz.radius * 0.26}
                cy={hz.radius * 0.14}
                r={hz.radius * 0.42}
                fill="#CBD5E1"
                opacity="0.25"
              />
              <circle
                cx={0}
                cy={hz.radius * 0.22}
                r={hz.radius * 0.36}
                fill="#64748B"
                opacity="0.3"
              />
              <circle
                cx="0"
                cy="0"
                r={hz.radius * 0.32}
                fill="none"
                stroke={ringColor}
                strokeWidth="1.4"
                opacity="0.55"
              />
            </g>
          );
        })}

        {/* Pooled Particles */}
        {particlesRef.current.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={p.size * (p.life / p.maxLife)}
            fill={p.color}
            opacity={Math.max(0, p.life / p.maxLife)}
          />
        ))}

        {/* Floating Damage / Score Text */}
        {floatingTextsRef.current.map((ft) => (
          <text
            key={ft.id}
            x={ft.x}
            y={ft.y}
            textAnchor="middle"
            fill={ft.color}
            stroke="#090D14"
            strokeWidth="3.5"
            paintOrder="stroke"
            fontSize="14"
            fontWeight="800"
            fontFamily="Barlow Condensed, sans-serif"
            opacity={Math.min(1, (ft.life / ft.maxLife) * 1.4)}
          >
            {ft.text}
          </text>
        ))}

        {/* Per-Round Shrinking Storm Overlay */}
        <g mask="url(#storm-zone-mask)" pointerEvents="none">
          <rect x={-1800} y={-1800} width={3600} height={3600} fill="rgba(220, 38, 38, 0.24)" />
          <rect x={-1800} y={-1800} width={3600} height={3600} fill="url(#storm-hatch)" />
        </g>

        <circle
          cx={zc.x}
          cy={zc.y}
          r={Math.max(0, zr)}
          fill="none"
          stroke="#F97316"
          strokeWidth="4.5"
          opacity="0.92"
        />
        <circle
          cx={zc.x}
          cy={zc.y}
          r={Math.max(0, zr + 4)}
          fill="none"
          stroke="#EF4444"
          strokeWidth="2"
          strokeDasharray="14 10"
          opacity="0.7"
        />
      </svg>

      {/* Storm Danger Edge Vignette */}
      {hud.inStorm && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            boxShadow: 'inset 0 0 90px rgba(239, 68, 68, 0.55)',
          }}
        />
      )}

      {/* Low-Occlusion World-Matched HUD (auto-adapts for phone portrait/landscape, tablet, and laptop) */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col justify-between"
        style={{
          paddingTop: isShortFrame
            ? 'max(0.5rem, env(safe-area-inset-top))'
            : 'max(0.75rem, env(safe-area-inset-top))',
          paddingBottom: isShortFrame
            ? 'max(0.5rem, env(safe-area-inset-bottom))'
            : 'max(0.75rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        }}
      >
        {/* Top Row: Left Round & Timing Zone | Center TDM / Survival Scoreboard | Right Controls */}
        <div className="flex flex-wrap items-start justify-between gap-2 md:flex-nowrap md:gap-3">
          {/* Top-Left: Round Phase Clock + 4-Round Progress + Zone Info */}
          <div className="order-1 flex flex-col gap-1">
            <div
              className={`flex items-center rounded-lg border border-slate-700/80 bg-[#121821]/92 shadow-lg ${
                isShortFrame ? 'gap-2 px-2.5 py-1.5' : 'gap-2.5 px-2.5 py-1.5 sm:gap-3.5 sm:px-3.5 sm:py-2'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                  R{hud.currentRound}/{hud.totalRounds}
                </span>
                <div className="mt-1 flex items-center gap-1">
                  {Array.from({ length: hud.totalRounds }).map((_, i) => {
                    const rIdx = i + 1;
                    const done = rIdx < hud.currentRound;
                    const active = rIdx === hud.currentRound;
                    return (
                      <span
                        key={rIdx}
                        className={`h-1.5 w-3 sm:w-4 rounded-sm ${
                          active
                            ? 'bg-amber-400'
                            : done
                              ? 'bg-emerald-400'
                              : 'bg-slate-700'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="h-6 sm:h-7 w-px bg-slate-700/80" />

              <div className="flex items-baseline gap-1.5">
                <span className="hidden sm:inline text-[11px] font-medium text-slate-400">Round</span>
                <span
                  className={`font-mono text-base sm:text-xl font-bold leading-none tabular-nums ${
                    hud.roundTimeRemainingSec <= 10 ? 'text-red-400' : 'text-amber-400'
                  }`}
                >
                  {formatTimer(hud.roundTimeRemainingSec)}
                </span>
              </div>

              <div className="hidden lg:block h-7 w-px bg-slate-700/80" />

              <div className="hidden lg:flex items-baseline gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Match
                </span>
                <span className="font-mono text-sm font-bold leading-none text-slate-200 tabular-nums">
                  {formatTimer(hud.matchTimeRemainingSec)}
                </span>
              </div>

              <div className="hidden sm:block h-6 sm:h-7 w-px bg-slate-700/80" />

              <div className="hidden sm:flex items-baseline gap-2 font-mono text-xs tabular-nums">
                <span className="inline-flex items-center gap-1 font-bold text-slate-100">
                  <Skull className="h-3.5 w-3.5 text-slate-400" />
                  {hud.kills}/{hud.deaths}
                </span>
                <span className="hidden md:inline font-bold text-amber-300">{hud.points} pts</span>
                <span className="inline-flex items-center gap-1 font-extrabold text-yellow-300">
                  <GoldCoinSvg size={14} />
                  {hud.totalCoins.toLocaleString()}
                  {hud.coinsEarned > 0 && (
                    <span className="hidden xl:inline text-[10px] font-bold text-emerald-400">
                      +{hud.coinsEarned}
                    </span>
                  )}
                </span>
                <span className="hidden xl:inline-flex items-center gap-1 font-bold text-sky-300">
                  Lv.{hud.playerLevel}
                </span>
                {hud.localStreak >= 2 && (
                  <span className="inline-flex items-center gap-0.5 font-extrabold text-orange-400">
                    <Flame className="h-3.5 w-3.5" />
                    x{hud.localStreak}
                  </span>
                )}
              </div>
            </div>

            {/* Safe-Zone & Map Sector Telemetry (auto-hides on ultra-short landscape frames to keep playfield wide open) */}
            {!isShortFrame && (
              <div className="hidden sm:flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs font-semibold">
                {hud.inStorm ? (
                  <span className="inline-flex items-center gap-1.5 text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    IN STORM — Move to safe zone
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    {hud.phaseLabel}
                  </span>
                )}
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span className="inline-flex items-center gap-1" style={{ color: zoneMeta.accent }}>
                  <Compass className="h-3.5 w-3.5" />
                  {zoneMeta.name}
                </span>
              </div>
            )}

            {!isShortFrame && hud.rareVaultRemaining > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-1 text-[11px] font-semibold text-amber-300/90">
                <Sparkles className="h-3 w-3 text-amber-400" />
                <span>
                  {hud.rareVaultRemaining} Rare Gold{' '}
                  {hud.rareVaultRemaining === 1 ? 'item' : 'items'} in Vault (+50 pts)
                </span>
              </div>
            )}
          </div>

          {/* Top-Center: TDM Live Scoreboard OR Survival Standing + Hype Banners & Kill Feed */}
          <div className="order-3 md:order-2 flex w-full md:w-auto flex-col items-center gap-1">
            {gameMode === 'tdm' ? (
              <div
                className={`flex items-center gap-2.5 sm:gap-3 rounded-lg border border-slate-700/80 bg-[#121821]/92 shadow-lg ${
                  isShortFrame ? 'px-2.5 py-1' : 'px-3 py-1.5 sm:px-3.5 sm:py-2'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-[10px] sm:text-[11px] font-extrabold tracking-wider text-red-400">
                    <span className="sm:hidden">RED</span>
                    <span className="hidden sm:inline">CRIMSON</span>
                  </span>
                  <span className="font-display text-xl sm:text-2xl font-bold leading-none text-red-200 tabular-nums">
                    {hud.redScore}
                  </span>
                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-300 tabular-nums">
                    {hud.redRoundsWon}W
                  </span>
                </div>

                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  VS
                </span>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="rounded bg-blue-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-300 tabular-nums">
                    {hud.blueRoundsWon}W
                  </span>
                  <span className="font-display text-xl sm:text-2xl font-bold leading-none text-blue-200 tabular-nums">
                    {hud.blueScore}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-extrabold tracking-wider text-blue-400">
                    <span className="sm:hidden">BLU</span>
                    <span className="hidden sm:inline">COBALT</span>
                  </span>
                </div>
              </div>
            ) : (
              <div
                className={`flex items-center gap-2.5 sm:gap-3 rounded-lg border border-slate-700/80 bg-[#121821]/92 shadow-lg ${
                  isShortFrame ? 'px-2.5 py-1' : 'px-3 py-1.5 sm:px-3.5 sm:py-2'
                }`}
              >
                <span className="text-xs font-semibold text-slate-400">
                  Alive{' '}
                  <strong className="font-mono text-sm text-slate-100 tabular-nums">
                    {hud.aliveCount}/{hud.totalCount}
                  </strong>
                </span>
                <div className="h-4 w-px bg-slate-700" />
                <span className="text-xs font-semibold text-slate-400">
                  Rank{' '}
                  <strong className="font-mono text-sm text-amber-300 tabular-nums">
                    #{hud.localRank}
                  </strong>
                </span>
                <div className="h-4 w-px bg-slate-700" />
                {hud.survivalResurgenceActive ? (
                  <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                    Resurge {Math.ceil(hud.survivalResurgenceLeftSec)}s
                  </span>
                ) : (
                  <span className="text-xs font-extrabold uppercase tracking-wider text-red-400 whitespace-nowrap">
                    Final Showdown
                  </span>
                )}
              </div>
            )}

            {/* Ultra-compact Mobile HP + Equipped Gun Strip on narrow phones (< md) so thumbs have 100% clear bottom corners */}
            {mobileControlsEnabled && (
              <div className="flex md:hidden items-center gap-2 rounded-lg border border-slate-700/80 bg-[#121821]/92 px-2.5 py-1 shadow-md">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-8 shrink-0">
                    <WeaponGraphicSvg
                      category={hud.weaponCategory}
                      upgradeLevel={hud.weaponUpgradeLevel}
                      rarity={hud.weaponRarity}
                      className="h-full w-full"
                      compact
                    />
                  </div>
                  <span
                    className="max-w-[92px] truncate text-[11px] font-bold"
                    style={{ color: equippedRarityMeta.color }}
                  >
                    {equippedWeaponMeta.name}
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-700" />
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold text-slate-200 tabular-nums">
                    HP {hud.health}
                  </span>
                  <div className="h-2 w-14 overflow-hidden rounded-sm bg-slate-800">
                    <div
                      className="h-full transition-all duration-100"
                      style={{
                        width: `${Math.max(0, Math.min(100, hud.health))}%`,
                        backgroundColor:
                          hud.health > 50 ? '#10B981' : hud.health > 25 ? '#F59E0B' : '#EF4444',
                      }}
                    />
                  </div>
                  {hud.shield > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold text-sky-400 tabular-nums">
                      <Shield className="h-2.5 w-2.5" />
                      {hud.shield}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* High-Energy Arcade Hype Banner (Killstreaks / Supply Drop / Overdrive Nova / Final Showdown) */}
            {hud.hypeBanner && hud.roundPhase === 'active' && (
              <div
                className="flex flex-col items-center rounded-lg border-2 bg-[#111824]/95 px-5 py-1.5 text-center shadow-2xl"
                style={{ borderColor: hud.hypeBanner.accent }}
              >
                <span
                  className="font-display text-2xl font-extrabold leading-none tracking-wider"
                  style={{ color: hud.hypeBanner.accent }}
                >
                  {hud.hypeBanner.title}
                </span>
                <span className="mt-0.5 text-[11px] font-semibold text-slate-200">
                  {hud.hypeBanner.subtitle}
                </span>
              </div>
            )}

            {/* TDM / Survival Resurgence Respawn Banner or Final Showdown Spectating Banner */}
            {hud.isDowned && hud.roundPhase === 'active' && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-red-500/60 bg-[#1A1318]/95 px-4 py-1.5 text-xs font-bold text-red-200">
                {gameMode === 'tdm' || hud.survivalResurgenceActive ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                    <span className="tabular-nums">
                      {gameMode === 'tdm' ? 'Respawning' : 'Resurgence respawn'} in{' '}
                      {hud.respawnTimerSec.toFixed(1)}s...
                    </span>
                  </>
                ) : (
                  <span>
                    Final Showdown · Spectating {hud.spectatingName || 'Arena'}
                  </span>
                )}
              </div>
            )}

            {hud.spawnShieldSec > 0 && !hud.isDowned && hud.roundCountdownSec <= 0 && (
              <div className="rounded-md border border-sky-400/60 bg-sky-950/90 px-3 py-1 text-xs font-bold text-sky-200 tabular-nums">
                Spawn Shield Active ({hud.spawnShieldSec.toFixed(1)}s)
              </div>
            )}

            {hud.inCover && !hud.isDowned && hud.roundCountdownSec <= 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/65 bg-emerald-950/92 px-3 py-1 text-xs font-bold text-emerald-200 shadow-md">
                <Shield className="h-3.5 w-3.5 text-emerald-400" />
                <span>IN COVER · -35% DMG · FAST REGEN</span>
              </div>
            )}

            {hud.isSnared && (
              <div className="rounded-md border border-purple-400/60 bg-purple-950/90 px-3 py-1 text-xs font-bold text-purple-200">
                SNARED — Movement Slowed
              </div>
            )}
            {hud.inSmoke && !hud.isSnared && (
              <div className="rounded-md border border-slate-500/70 bg-slate-900/90 px-3 py-1 text-xs font-semibold text-slate-200">
                Concealed in Smoke Shroud
              </div>
            )}
            {hud.killFeed.map((entry) => (
              <div
                key={entry.id}
                className="rounded-md border border-slate-700/70 bg-[#121821]/92 px-3 py-1 text-xs font-medium text-slate-100"
              >
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ backgroundColor: entry.accent }}
                />
                {entry.text}
              </div>
            ))}
          </div>

          {/* Top-Right Controls */}
          <div className="order-2 md:order-3 pointer-events-auto flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={toggleMobileControls}
              title={mobileControlsEnabled ? 'Hide Mobile Controller' : 'Show Mobile Controller'}
              aria-pressed={mobileControlsEnabled}
              className={`inline-flex h-9 sm:h-10 items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                mobileControlsEnabled
                  ? 'border-amber-400/80 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                  : 'border-slate-700/80 bg-[#121821]/92 text-slate-200 hover:border-amber-400/70 hover:text-amber-300'
              }`}
            >
              <Gamepad2
                className={`h-4 w-4 ${mobileControlsEnabled ? 'text-amber-300' : 'text-slate-400'}`}
              />
              <span className="hidden lg:inline">
                {mobileControlsEnabled ? 'Touch Pad ON' : 'Touch Pad'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setScoreboardOpen((s) => !s)}
              title="Live Avatar Scoreboard (Tab)"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#121821]/92 px-3 text-xs font-bold text-slate-200 transition-colors hover:border-amber-400/70 hover:text-amber-300 whitespace-nowrap shrink-0"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">Scores</span>
              <span className="hidden md:inline font-mono text-[10px] text-slate-400">[Tab]</span>
            </button>
            {mode === 'multi' && room && (
              <button
                type="button"
                onClick={copyRoomCode}
                title="Copy Room Code"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#121821]/92 px-3 font-mono text-xs font-bold text-slate-200 transition-colors hover:border-amber-400/70 hover:text-amber-300 whitespace-nowrap shrink-0"
              >
                <span>{room.roomId}</span>
                {copiedCode ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMuted(audioEngine.toggleMute())}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/80 bg-[#121821]/92 text-slate-200 transition-colors hover:bg-slate-800"
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-slate-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-amber-400" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label="Pause match"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/80 bg-[#121821]/92 text-slate-200 transition-colors hover:bg-slate-800"
            >
              <Pause className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Bottom Row: 4-Zone Tactical Radar | Weapon + Health + Utility Loadout | Controls */}
        <div
          className={`flex items-end gap-4 ${
            mobileControlsEnabled ? 'justify-center pb-1' : 'justify-between'
          }`}
        >
          {!mobileControlsEnabled && (
            <div className="rounded-lg border border-slate-700/80 bg-[#121821]/92 p-2 shadow-lg">
              <svg
                width="116"
                height="116"
                viewBox="-820 -820 1640 1640"
                aria-label="4-zone arena minimap"
              >
                <circle
                  cx="0"
                  cy="0"
                  r={ARENA_RADIUS}
                  fill="#18202B"
                  stroke="#475569"
                  strokeWidth="26"
                />
                <path d={DENSE_SECTOR_PATH} fill="rgba(234, 88, 12, 0.2)" />
                <path d={OPEN_SECTOR_PATH} fill="rgba(56, 189, 248, 0.16)" />
                <path d={FLANK_SECTOR_PATH} fill="rgba(20, 184, 166, 0.18)" />
                <circle
                  cx="0"
                  cy="0"
                  r={RESOURCE_ZONE_RADIUS}
                  fill="rgba(250, 204, 21, 0.18)"
                  stroke="#FACC15"
                  strokeWidth="18"
                />

                {hazardsRef.current.map((hz) => (
                  <circle
                    key={hz.id}
                    cx={hz.x}
                    cy={hz.y}
                    r={hz.radius}
                    fill="#94A3B8"
                    opacity="0.45"
                  />
                ))}

                {visiblePickups.map((pk) => {
                  if (!pk.active || pk.rarity !== 'rare') return null;
                  return (
                    <polygon
                      key={pk.pickupId}
                      points={`${pk.x},${pk.y - 52} ${pk.x + 52},${pk.y} ${pk.x},${pk.y + 52} ${pk.x - 52},${pk.y}`}
                      fill="#FACC15"
                      stroke="#090D14"
                      strokeWidth="14"
                    />
                  );
                })}

                <circle
                  cx={zc.x}
                  cy={zc.y}
                  r={Math.max(0, zr)}
                  fill="none"
                  stroke="#F97316"
                  strokeWidth="30"
                />

                {fightersSorted.map((f) => {
                  if (f.status !== 'alive') return null;
                  const isFriendly = localFighter ? areTeammates(localFighter, f) : false;
                  if (!f.isLocal && !isFriendly && isInsideSmoke(f.x, f.y, hazardsRef.current)) {
                    return null;
                  }
                  const dotFill = f.isLocal
                    ? '#FFFFFF'
                    : f.team !== 'none'
                      ? TEAM_META[f.team].color
                      : f.color;
                  return (
                    <circle
                      key={f.id}
                      cx={f.x}
                      cy={f.y}
                      r={f.isLocal ? 60 : 44}
                      fill={dotFill}
                      stroke="#090D14"
                      strokeWidth="14"
                    />
                  );
                })}
              </svg>
            </div>
          )}

          {/* Bottom-Center: Swap Prompt + Active Buffs + Compact Weapon / Health / Utility Bar */}
          <div
            className={`flex-col items-center gap-2 ${
              mobileControlsEnabled ? 'hidden md:flex' : 'flex'
            }`}
          >
            {!mobileControlsEnabled && hud.swapPrompt && (
              <button
                type="button"
                onClick={() => {
                  justPressedSwapRef.current = true;
                }}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border bg-[#121821]/95 px-3.5 py-1.5 text-xs font-bold shadow-lg transition-colors hover:bg-slate-800"
                style={{
                  borderColor: RARITY_META[hud.swapPrompt.rarity].border,
                  color: RARITY_META[hud.swapPrompt.rarity].color,
                }}
              >
                <Repeat2 className="h-3.5 w-3.5" />
                <span>
                  [E] Swap to {RARITY_META[hud.swapPrompt.rarity].label} {hud.swapPrompt.label}
                </span>
                <span className="text-[10px] font-medium text-slate-400">
                  ({hud.swapPrompt.role})
                </span>
              </button>
            )}

            {!mobileControlsEnabled &&
              !hud.swapPrompt &&
              !hud.inCover &&
              hud.canSnapCover &&
              !hud.isDowned && (
                <button
                  type="button"
                  onClick={() => {
                    justPressedCoverRef.current = true;
                  }}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/65 bg-[#0F1F1B]/94 px-3 py-1 text-xs font-bold text-emerald-300 shadow-md transition-colors hover:bg-emerald-950"
                >
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  <span>[C] Take Cover Behind Block (-35% DMG)</span>
                </button>
              )}

            {(hud.speedBoostSec > 0 || hud.damageBoostSec > 0) && (
              <div className="flex items-center gap-3 text-xs font-semibold">
                {hud.speedBoostSec > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-300 tabular-nums">
                    <Zap className="h-3.5 w-3.5" />
                    Speed {hud.speedBoostSec.toFixed(1)}s
                  </span>
                )}
                {hud.damageBoostSec > 0 && (
                  <span className="inline-flex items-center gap-1 text-orange-400 tabular-nums">
                    <Swords className="h-3.5 w-3.5" />
                    Power {hud.damageBoostSec.toFixed(1)}s
                  </span>
                )}
              </div>
            )}

            <div
              className={`flex items-center rounded-lg border border-slate-700/80 bg-[#121821]/92 shadow-lg ${
                mobileControlsEnabled ? 'gap-2 px-2.5 py-1.5' : 'gap-3 px-3.5 py-2.5'
              }`}
            >
              {/* Equipped Primary Graphic Gun Slot */}
              <div
                className={`flex items-center rounded-md border ${
                  mobileControlsEnabled
                    ? 'min-w-[126px] gap-1.5 px-2 py-1'
                    : 'min-w-[168px] gap-2.5 px-2.5 py-1.5'
                }`}
                style={{
                  borderColor: equippedRarityMeta.border,
                  backgroundColor: equippedRarityMeta.bg,
                }}
              >
                <div
                  className={`flex shrink-0 items-center justify-center rounded bg-[#0B1018]/85 px-1 ${
                    mobileControlsEnabled ? 'h-8 w-11' : 'h-10 w-14'
                  }`}
                >
                  <WeaponGraphicSvg
                    category={hud.weaponCategory}
                    upgradeLevel={hud.weaponUpgradeLevel}
                    rarity={hud.weaponRarity}
                    className={mobileControlsEnabled ? 'h-6 w-full' : 'h-8 w-full'}
                    compact
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider"
                      style={{ color: equippedRarityMeta.color }}
                    >
                      <Crosshair className="h-2.5 w-2.5" />
                      {equippedRarityMeta.label}
                    </span>
                    <span
                      className="rounded bg-slate-900/90 px-1 py-0.2 font-mono text-[9px] font-extrabold tabular-nums"
                      style={{ color: getGunUpgradeTier(hud.weaponUpgradeLevel).accent }}
                    >
                      {getGunUpgradeTier(hud.weaponUpgradeLevel).code} · {localSpec.damage}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs font-bold text-slate-50">
                    {equippedWeaponMeta.name}
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-900/90">
                    <div
                      className="h-full transition-all duration-75"
                      style={{
                        width: `${Math.round(hud.weaponReadyPct * 100)}%`,
                        backgroundColor: equippedRarityMeta.color,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="h-9 w-px bg-slate-700/80" />

              {/* HP & Shield Bars */}
              <div className={mobileControlsEnabled ? 'w-24 sm:w-36' : 'w-36 sm:w-48'}>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300 tabular-nums">HP {hud.health}</span>
                  {hud.shield > 0 && (
                    <span className="inline-flex items-center gap-1 text-sky-400 tabular-nums">
                      <Shield className="h-3 w-3" />
                      {hud.shield}
                    </span>
                  )}
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-sm bg-slate-800">
                  <div
                    className="h-full transition-all duration-100"
                    style={{
                      width: `${Math.max(0, Math.min(100, hud.health))}%`,
                      backgroundColor:
                        hud.health > 50 ? '#10B981' : hud.health > 25 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
                {hud.shield > 0 && (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-slate-800">
                    <div
                      className="h-full bg-sky-400 transition-all duration-100"
                      style={{
                        width: `${Math.max(0, Math.min(100, (hud.shield / 50) * 100))}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              {!mobileControlsEnabled && (
                <>
                  <div className="h-10 w-px bg-slate-700/80" />

                  {/* Area Utility Slot */}
                  <button
                    type="button"
                    onClick={() => {
                      justPressedUtilityRef.current = true;
                    }}
                    disabled={hud.utilityCharges <= 0}
                    className="pointer-events-auto flex min-w-[84px] flex-col items-center rounded-md border px-2 py-1.5 text-center transition-colors disabled:opacity-45"
                    style={{
                      borderColor:
                        hud.utilityRarity !== 'none'
                          ? RARITY_META[hud.utilityRarity].border
                          : 'rgba(71, 85, 105, 0.7)',
                      backgroundColor:
                        hud.utilityRarity !== 'none'
                          ? RARITY_META[hud.utilityRarity].bg
                          : 'rgba(15, 23, 42, 0.7)',
                    }}
                  >
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-200">
                      <CloudFog className="h-3 w-3 text-purple-300" />
                      <span>[Q] x{hud.utilityCharges}</span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-300">Shroud</span>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-900">
                      <div
                        className="h-full bg-purple-400"
                        style={{
                          width: `${hud.utilityCharges > 0 ? Math.round(hud.utilityReadyPct * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </button>

                  {/* Overdrive Shockwave Nova Ultimate Slot ([R]) */}
                  <button
                    type="button"
                    onClick={() => {
                      justPressedNovaRef.current = true;
                    }}
                    disabled={hud.overdrivePct < 100}
                    className={`pointer-events-auto flex min-w-[84px] flex-col items-center rounded-md border px-2 py-1.5 text-center transition-all ${
                      hud.overdrivePct >= 100
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-lg shadow-cyan-500/20 hover:bg-cyan-500/30'
                        : 'border-slate-700/80 bg-slate-900/75 text-slate-400 opacity-85'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[10px] font-extrabold tabular-nums">
                      <Sparkles className="h-3 w-3 text-cyan-300" />
                      <span>{hud.overdrivePct >= 100 ? '[R] READY' : `${hud.overdrivePct}%`}</span>
                    </div>
                    <span className="text-[10px] font-bold tracking-wide">Nova</span>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-950">
                      <div
                        className="h-full transition-all duration-150"
                        style={{
                          width: `${hud.overdrivePct}%`,
                          backgroundColor: hud.overdrivePct >= 100 ? '#22D3EE' : '#38BDF8',
                        }}
                      />
                    </div>
                  </button>

                  {/* Dash Cooldown */}
                  <div className="hidden sm:flex flex-col items-center">
                    <span className="text-[10px] font-medium text-slate-400">Dash</span>
                    <div className="mt-1 h-2 w-10 overflow-hidden rounded-sm bg-slate-800">
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${Math.round(hud.dashReadyPct * 100)}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bottom-Right: Desktop Action Prompt (hidden when MobileController is active) */}
          {!mobileControlsEnabled && (
            <div className="hidden lg:block text-right text-xs font-medium text-slate-400">
              <span>WASD Move</span>
              <span className="mx-1.5 opacity-50">·</span>
              <span className={hud.inCover || hud.canSnapCover ? 'font-bold text-emerald-400' : ''}>
                C Cover
              </span>
              <span className="mx-1.5 opacity-50">·</span>
              <span>Shift Dash</span>
              <span className="mx-1.5 opacity-50">·</span>
              <span className={hud.hasTargetInRange ? 'font-bold text-amber-400' : ''}>
                Space/Click Attack
              </span>
              <span className="mx-1.5 opacity-50">·</span>
              <span>Q Shroud</span>
              <span className="mx-1.5 opacity-50">·</span>
              <span className={hud.overdrivePct >= 100 ? 'font-bold text-cyan-300' : ''}>
                R Nova
              </span>
              <span className="mx-1.5 opacity-50">·</span>
              <span>Tab Scores</span>
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Multi-Touch Mobile Gamepad Overlay */}
      {mobileControlsEnabled &&
        !paused &&
        hud.roundPhase === 'active' &&
        !hud.isDowned && (
          <MobileController
            weaponName={equippedWeaponMeta.name}
            weaponRarity={hud.weaponRarity}
            weaponReadyPct={hud.weaponReadyPct}
            hasTargetInRange={hud.hasTargetInRange}
            dashReadyPct={hud.dashReadyPct}
            inCover={hud.inCover}
            canSnapCover={hud.canSnapCover}
            utilityCharges={hud.utilityCharges}
            utilityReadyPct={hud.utilityReadyPct}
            overdrivePct={hud.overdrivePct}
            swapPrompt={hud.swapPrompt}
            autoFire={autoFireEnabled}
            viewportW={viewport.w}
            viewportH={viewport.h}
            onToggleAutoFire={handleToggleAutoFire}
            onMoveVector={handleMobileMoveVector}
            onFireChange={handleMobileFireChange}
            onDash={handleMobileDash}
            onCover={handleMobileCover}
            onUtility={handleMobileUtility}
            onNova={handleMobileNova}
            onSwap={handleMobileSwap}
          />
        )}

      {/* Pre-Round 3-2-1-FIGHT! Staging Countdown Overlay */}
      {hud.roundPhase === 'active' && hud.roundCountdownSec > 0 && !paused && (
        <div className="pointer-events-none absolute inset-0 z-15 flex items-center justify-center">
          <div className="flex flex-col items-center rounded-2xl border border-amber-400/50 bg-[#0D131C]/88 px-10 py-6 text-center shadow-2xl backdrop-blur-xs">
            <span className="text-xs font-extrabold uppercase tracking-[0.25em] text-amber-400">
              Round {hud.currentRound} of {hud.totalRounds} ·{' '}
              {gameMode === 'tdm' ? 'Team Deathmatch' : 'Survival Resurgence'}
            </span>
            <div className="mt-1 font-display text-7xl font-extrabold leading-none tracking-wider text-slate-50 tabular-nums">
              {Math.max(1, Math.ceil(hud.roundCountdownSec))}
            </div>
            <p className="mt-2 max-w-xs text-xs font-medium text-slate-300">
              Hug any block or press [C] for -35% cover defense & fast regen, use Boost Pads to flank, and unleash [R] Overdrive Nova!
            </p>
          </div>
        </div>
      )}

      {/* Between-Round Phase Scorecard Intermission Overlay */}
      {hud.roundPhase === 'intermission' && hud.lastRoundResult && (
        <div className="absolute inset-0 z-20 flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain bg-[#0B0F17]/78 p-3 sm:p-4">
          <div className="my-auto w-full max-w-xl rounded-xl border border-slate-700 bg-[#151C27]/96 p-4 sm:p-5 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                  Phase {hud.lastRoundResult.round} of {hud.totalRounds} Complete
                </p>
                <h2
                  className="font-display text-3xl font-bold tracking-wide"
                  style={{ color: hud.lastRoundResult.winnerAccent }}
                >
                  {hud.lastRoundResult.winnerLabel} Wins Round {hud.lastRoundResult.round}
                </h2>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-semibold text-slate-400">
                  Round {Math.min(hud.totalRounds, hud.currentRound + 1)} starts in
                </span>
                <div className="font-mono text-2xl font-bold text-amber-400 tabular-nums">
                  {Math.max(0, hud.intermissionLeftSec).toFixed(1)}s
                </div>
              </div>
            </div>

            {gameMode === 'tdm' && (
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="flex items-center justify-between rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-300">
                      Team Crimson
                    </p>
                    <p className="font-mono text-xs text-red-200/80 tabular-nums">
                      +{hud.lastRoundResult.redRoundPoints} pts this round · {hud.redRoundsWon}W
                    </p>
                  </div>
                  <span className="font-display text-2xl font-bold text-red-200 tabular-nums">
                    {hud.redScore}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-blue-500/35 bg-blue-500/10 px-3 py-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                      Team Cobalt
                    </p>
                    <p className="font-mono text-xs text-blue-200/80 tabular-nums">
                      +{hud.lastRoundResult.blueRoundPoints} pts this round · {hud.blueRoundsWon}W
                    </p>
                  </div>
                  <span className="font-display text-2xl font-bold text-blue-200 tabular-nums">
                    {hud.blueScore}
                  </span>
                </div>
              </div>
            )}

            {/* Per-Avatar Calculated Standings */}
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-700/80 bg-[#0F151F]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-2 py-2">Avatar</th>
                    <th className="px-2 py-2 text-right">K / D</th>
                    <th className="px-2 py-2 text-right">Rd Pts</th>
                    <th className="px-3 py-2 text-right">Total Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {hud.avatarScores.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className={entry.isLocal ? 'bg-amber-500/10' : 'bg-transparent'}
                    >
                      <td className="px-3 py-1.5 font-mono font-bold text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <svg width="20" height="24" viewBox="-20 -34 40 58" className="shrink-0">
                            <StickFigureSvg
                              x={0}
                              y={0}
                              color={entry.color}
                              accessory={entry.accessory}
                              team={entry.team}
                              animState="idle"
                              animPhase={0}
                              facing={0}
                              health={100}
                              shield={0}
                              showHud={false}
                              scale={0.78}
                            />
                          </svg>
                          <span className="font-semibold text-slate-100">
                            {entry.displayName}
                            {entry.isLocal && (
                              <span className="ml-1 text-[10px] font-bold text-amber-400">
                                (You)
                              </span>
                            )}
                          </span>
                          {entry.team !== 'none' && (
                            <span
                              className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                              style={{
                                backgroundColor: TEAM_META[entry.team].bg,
                                color: TEAM_META[entry.team].color,
                              }}
                            >
                              {entry.team === 'red' ? 'RED' : 'BLU'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-slate-300 tabular-nums">
                        {entry.kills}/{entry.deaths}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-semibold text-emerald-400 tabular-nums">
                        +{entry.roundPoints}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-amber-300 tabular-nums">
                        {entry.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                Fresh weapons & 2 Rare Gold Vault items spawn every round
              </span>
              {mode === 'solo' && (
                <button
                  type="button"
                  onClick={() => {
                    intermissionLeftRef.current = 0;
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5" />
                  Start Round {Math.min(hud.totalRounds, hud.currentRound + 1)} Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live [Tab] Per-Avatar Scoreboard Overlay */}
      {scoreboardOpen && hud.roundPhase === 'active' && !paused && (
        <div className="absolute inset-0 z-25 flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain bg-[#0B0F17]/72 p-3 sm:p-4">
          <div className="my-auto w-full max-w-2xl rounded-xl border border-slate-700 bg-[#151C27]/96 p-4 sm:p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                  {gameMode === 'tdm' ? 'Team Deathmatch' : 'Survival Points'} · Round{' '}
                  {hud.currentRound}/{hud.totalRounds}
                </p>
                <h3 className="font-display text-2xl font-bold tracking-wide text-slate-50">
                  Live Avatar Standings
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setScoreboardOpen(false)}
                className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 whitespace-nowrap"
              >
                Close [Tab]
              </button>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-700/80 bg-[#0F151F]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-2 py-2">Avatar</th>
                    <th className="px-2 py-2 text-right">Kills</th>
                    <th className="px-2 py-2 text-right">Deaths</th>
                    <th className="px-2 py-2 text-right">Damage</th>
                    <th className="px-2 py-2 text-right">Rd Wins</th>
                    <th className="px-3 py-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {hud.avatarScores.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className={entry.isLocal ? 'bg-amber-500/12' : 'bg-transparent'}
                    >
                      <td className="px-3 py-2 font-mono font-bold text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <svg width="20" height="24" viewBox="-20 -34 40 58" className="shrink-0">
                            <StickFigureSvg
                              x={0}
                              y={0}
                              color={entry.color}
                              accessory={entry.accessory}
                              team={entry.team}
                              animState="idle"
                              animPhase={0}
                              facing={0}
                              health={100}
                              shield={0}
                              showHud={false}
                              scale={0.78}
                            />
                          </svg>
                          <span className="font-semibold text-slate-100">
                            {entry.displayName}
                            {entry.isLocal && (
                              <span className="ml-1 text-[10px] font-bold text-amber-400">
                                (You)
                              </span>
                            )}
                          </span>
                          {entry.team !== 'none' && (
                            <span
                              className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                              style={{
                                backgroundColor: TEAM_META[entry.team].bg,
                                color: TEAM_META[entry.team].color,
                              }}
                            >
                              {entry.team === 'red' ? 'CRIMSON' : 'COBALT'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-semibold text-slate-100 tabular-nums">
                        {entry.kills}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-slate-400 tabular-nums">
                        {entry.deaths}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-slate-300 tabular-nums">
                        {entry.damageDealt}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-emerald-400 tabular-nums">
                        {entry.roundWins}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-amber-300 tabular-nums">
                        {entry.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-[11px] text-slate-400">
              Scoring: +{SCORE_RULES.KILL} Kill · +1 pt / {SCORE_RULES.DAMAGE_DIVISOR} Damage · +
              {SCORE_RULES.RARE_CLAIM} Rare Vault Claim · +{SCORE_RULES.ROUND_WIN} Round Win
            </p>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {paused && (
        <div className="absolute inset-0 z-30 flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain bg-[#0B0F17]/80 p-4">
          <div className="my-auto w-full max-w-sm rounded-xl border border-slate-700 bg-[#161D28] p-6 shadow-2xl">
            <h2 className="font-display text-3xl font-bold tracking-wide text-slate-50">
              Match Paused
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {mode === 'multi'
                ? 'Multiplayer rooms stay live while this menu is open.'
                : 'Solo simulation paused. Resume whenever you are ready.'}
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setPaused(false)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400"
              >
                <Play className="h-4 w-4" />
                Resume Match
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaused(false);
                  onExitMatch();
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700"
              >
                <LogOut className="h-4 w-4" />
                Leave Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
