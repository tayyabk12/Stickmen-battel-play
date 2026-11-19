import {
  ARENA_RADIUS,
  INTERPOLATION_LAMBDA,
  PLAYER_RADIUS,
  RESOURCE_ZONE_RADIUS,
  type ActiveHazard,
  type FighterEntity,
  type LootRarity,
  type MapZoneId,
  type Obstacle,
  type PickupData,
  type PickupType,
} from '../types/game';

/** Deterministic PRNG (Mulberry32) so Web and Android generate identical zone layouts from room.seed */
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Determine which of the 4 purposeful architectural zones a world point falls in:
 * - 'resource' (Sundial Vault): Center circle (r <= 175) — exposed dais where Rare Gold weapons spawn.
 * - 'dense'    (Instrument Maze): West / North-West sector (135°..270° / -90°..-225°) — tight Jantar Mantar corridors.
 * - 'open'     (Outer Colonnade): East / North-East sector (-90°..45°) — wide CP-inspired sightlines.
 * - 'flank'    (Crossway Bazaar): South sector (45°..135°) — mid-range shortcut & tactical cover.
 */
export function getMapZoneAt(x: number, y: number): MapZoneId {
  const r = Math.hypot(x, y);
  if (r <= RESOURCE_ZONE_RADIUS) return 'resource';
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  if (deg >= 135 && deg < 270) return 'dense';
  if (deg >= 45 && deg < 135) return 'flank';
  return 'open';
}

/**
 * Generate the 4-zone architectural obstacle layout:
 * - Resource Zone (Center Sundial Vault): 4 symmetrical gateway pillars leaving exposed sightlines into center.
 * - Dense Zone (Jantar Mantar Instrument Maze): Stepped geometric walls, quadrant corridors, and close-quarters cover.
 * - Open Zone (CP Outer Colonnade): Wide open sightlines with only sparse slim outer ring columns.
 * - Flank Zone (Crossway Bazaar): Diagonal cover barricades forming fast mid-range flanks between Dense & Open.
 */
export function generateArenaObstacles(seed: number): Obstacle[] {
  const rng = createSeededRng(seed);
  const obstacles: Obstacle[] = [];

  // 1. Resource Zone — Sundial Vault: 4 symmetrical gateway pillars on the vault rim
  //    Provides brief peek cover while leaving the central Gold pedestals exposed from all 4 approaches.
  const vaultAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  vaultAngles.forEach((ang, idx) => {
    obstacles.push({
      id: `obs_vault_${idx}`,
      kind: 'pillar',
      zone: 'resource',
      x: Math.round(Math.cos(ang) * (RESOURCE_ZONE_RADIUS + 4)),
      y: Math.round(Math.sin(ang) * (RESOURCE_ZONE_RADIUS + 4)),
      radius: 24,
    });
  });

  // 2. Dense Zone — Instrument Maze (West / North-West: 135° to 270°)
  //    Inspired by Jantar Mantar's stepped geometric sundials & tight masonry corridors.
  const denseStructures: Array<{
    x: number;
    y: number;
    kind: 'wall' | 'pillar' | 'crate';
    w?: number;
    h?: number;
    radius: number;
  }> = [
    // Inner quadrant gnomon walls framing tight corridor entrances
    { x: -275, y: -115, kind: 'wall', w: 96, h: 30, radius: 34 },
    { x: -160, y: -275, kind: 'wall', w: 30, h: 96, radius: 34 },
    // Mid-maze stepped geometric slabs creating close-quarters ambush pockets
    { x: -415, y: -65, kind: 'wall', w: 32, h: 112, radius: 36 },
    { x: -335, y: -260, kind: 'wall', w: 108, h: 30, radius: 36 },
    { x: -230, y: -425, kind: 'wall', w: 104, h: 30, radius: 36 },
    // Circular astrolabe dials (tight corner pivots)
    { x: -485, y: -235, kind: 'pillar', radius: 34 },
    { x: -395, y: -415, kind: 'pillar', radius: 30 },
    // Lower-west instrument choke crates
    { x: -285, y: 120, kind: 'crate', w: 72, h: 42, radius: 32 },
    { x: -475, y: 110, kind: 'wall', w: 86, h: 30, radius: 32 },
    { x: -570, y: -90, kind: 'crate', w: 58, h: 58, radius: 34 },
    { x: -105, y: -490, kind: 'crate', w: 66, h: 42, radius: 30 },
  ];

  denseStructures.forEach((st, idx) => {
    const jitterX = Math.round((rng() - 0.5) * 18);
    const jitterY = Math.round((rng() - 0.5) * 18);
    obstacles.push({
      id: `obs_dense_${idx}`,
      kind: st.kind,
      zone: 'dense',
      x: st.x + jitterX,
      y: st.y + jitterY,
      radius: st.radius,
      w: st.w,
      h: st.h,
    });
  });

  // 3. Open Zone — Outer Colonnade (East / North-East: -90° to 45°)
  //    Inspired by Connaught Place's grand radial ring: vast open sightlines for Long-Range lances,
  //    with ONLY sparse slim columns along the outer arcade perimeter.
  const colonnadeAngles = [-68, -32, 4, 34].map((d) => (d * Math.PI) / 180);
  colonnadeAngles.forEach((ang, idx) => {
    const r = 575 + Math.round((rng() - 0.5) * 26);
    obstacles.push({
      id: `obs_open_col_${idx}`,
      kind: 'pillar',
      zone: 'open',
      x: Math.round(Math.cos(ang) * r),
      y: Math.round(Math.sin(ang) * r),
      radius: 20,
    });
  });
  // Two modest mid-ring colonnade plinths so crossings remain risky and readable
  obstacles.push(
    {
      id: 'obs_open_mid_0',
      kind: 'pillar',
      zone: 'open',
      x: 345 + Math.round((rng() - 0.5) * 22),
      y: -210 + Math.round((rng() - 0.5) * 22),
      radius: 22,
    },
    {
      id: 'obs_open_mid_1',
      kind: 'pillar',
      zone: 'open',
      x: 385 + Math.round((rng() - 0.5) * 22),
      y: 120 + Math.round((rng() - 0.5) * 22),
      radius: 22,
    }
  );

  // 4. Flank Zone — Crossway Bazaar (South: 45° to 135°)
  //    Balanced diagonal cover crates providing mid-range skirmish lanes & quick shortcut between Dense & Open.
  const flankStructures: Array<{ x: number; y: number; kind: 'crate' | 'pillar'; w?: number; h?: number; radius: number }> = [
    { x: -120, y: 315, kind: 'crate', w: 74, h: 40, radius: 32 },
    { x: 120, y: 315, kind: 'crate', w: 74, h: 40, radius: 32 },
    { x: 0, y: 455, kind: 'pillar', radius: 28 },
    { x: -195, y: 495, kind: 'crate', w: 68, h: 42, radius: 30 },
    { x: 195, y: 495, kind: 'crate', w: 68, h: 42, radius: 30 },
  ];

  flankStructures.forEach((st, idx) => {
    obstacles.push({
      id: `obs_flank_${idx}`,
      kind: st.kind,
      zone: 'flank',
      x: st.x + Math.round((rng() - 0.5) * 16),
      y: st.y + Math.round((rng() - 0.5) * 16),
      radius: st.radius,
      w: st.w,
      h: st.h,
    });
  });

  return obstacles;
}

/** Resolve position against circular arena boundary and rectangular/circular obstacles */
export function resolveArenaCollisions(
  x: number,
  y: number,
  obstacles: Obstacle[],
  entityRadius = PLAYER_RADIUS
): { x: number; y: number } {
  let nx = x;
  let ny = y;

  for (const obs of obstacles) {
    if ((obs.kind === 'crate' || obs.kind === 'wall') && obs.w && obs.h) {
      const halfW = obs.w / 2;
      const halfH = obs.h / 2;
      const closestX = Math.max(obs.x - halfW, Math.min(nx, obs.x + halfW));
      const closestY = Math.max(obs.y - halfH, Math.min(ny, obs.y + halfH));
      const dx = nx - closestX;
      const dy = ny - closestY;
      const distSq = dx * dx + dy * dy;
      if (distSq < entityRadius * entityRadius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.001) {
          const push = entityRadius - dist;
          nx += (dx / dist) * push;
          ny += (dy / dist) * push;
        } else {
          // Inside rect center fallback: push along shallowest axis
          const penX = halfW + entityRadius - Math.abs(nx - obs.x);
          const penY = halfH + entityRadius - Math.abs(ny - obs.y);
          if (penX < penY) {
            nx += nx >= obs.x ? penX : -penX;
          } else {
            ny += ny >= obs.y ? penY : -penY;
          }
        }
      }
    } else {
      const dx = nx - obs.x;
      const dy = ny - obs.y;
      const minDist = entityRadius + obs.radius;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 0.001;
        const push = minDist - dist;
        nx += (dx / dist) * push;
        ny += (dy / dist) * push;
      }
    }
  }

  const maxR = ARENA_RADIUS - entityRadius;
  const distFromOrigin = Math.hypot(nx, ny);
  if (distFromOrigin > maxR) {
    nx = (nx / distFromOrigin) * maxR;
    ny = (ny / distFromOrigin) * maxR;
  }

  return { x: nx, y: ny };
}

/** Check if a line segment (x1,y1)->(x2,y2) intersects an AABB (Liang-Barsky slab test) */
function segmentIntersectsBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const checks: [number, number][] = [
    [-dx, x1 - minX],
    [dx, maxX - x1],
    [-dy, y1 - minY],
    [dy, maxY - y1],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-6) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}

/** Check if a line segment intersects a circle */
function segmentIntersectsCircle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return Math.hypot(cx - x1, cy - y1) <= r;
  const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r;
}

export interface CoverInfo {
  obstacle: Obstacle;
  contactX: number;
  contactY: number;
  normalX: number;
  normalY: number;
  gap: number;
}

export interface ObstacleHitPoint {
  x: number;
  y: number;
  t: number;
  obstacle: Obstacle;
}

/** Ray-vs-AABB intersection returning earliest hit fraction t in [0,1], or null */
function raycastBoxT(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): number | null {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const checks: [number, number][] = [
    [-dx, x1 - minX],
    [dx, maxX - x1],
    [-dy, y1 - minY],
    [dy, maxY - y1],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-6) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1 ? t0 : null;
}

/** Ray-vs-Circle intersection returning earliest hit fraction t in [0,1], or null */
function raycastCircleT(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number
): number | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-6) return fx * fx + fy * fy <= r * r ? 0 : null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sqrtD = Math.sqrt(disc);
  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;
  if (t2 >= 0 && t2 <= 1) return 0;
  return null;
}

/**
 * Cast a ray from (x1,y1) to (x2,y2) against all solid arena blocks (walls, crates, pillars).
 * Returns the earliest block surface hit point so beams stop cleanly on cover blocks with sparks.
 */
export function raycastObstacleHit(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: Obstacle[]
): ObstacleHitPoint | null {
  let bestT = Infinity;
  let bestObs: Obstacle | null = null;

  for (const obs of obstacles) {
    let t: number | null = null;
    if ((obs.kind === 'crate' || obs.kind === 'wall') && obs.w && obs.h) {
      t = raycastBoxT(
        x1,
        y1,
        x2,
        y2,
        obs.x - obs.w / 2,
        obs.y - obs.h / 2,
        obs.x + obs.w / 2,
        obs.y + obs.h / 2
      );
    } else {
      t = raycastCircleT(x1, y1, x2, y2, obs.x, obs.y, Math.max(4, obs.radius - 2));
    }
    if (t !== null && t < bestT) {
      bestT = t;
      bestObs = obs;
    }
  }

  if (!bestObs || bestT > 1) return null;
  return {
    x: x1 + (x2 - x1) * bestT,
    y: y1 + (y2 - y1) * bestT,
    t: bestT,
    obstacle: bestObs,
  };
}

/** Pure solid-block line-of-sight check (blocks ALL weapons, including close-range, from hitting through blocks) */
export function hasObstacleLineOfSight(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: Obstacle[]
): boolean {
  for (const obs of obstacles) {
    if ((obs.kind === 'crate' || obs.kind === 'wall') && obs.w && obs.h) {
      if (
        segmentIntersectsBox(
          x1,
          y1,
          x2,
          y2,
          obs.x - obs.w / 2,
          obs.y - obs.h / 2,
          obs.x + obs.w / 2,
          obs.y + obs.h / 2
        )
      ) {
        return false;
      }
    } else if (segmentIntersectsCircle(x1, y1, x2, y2, obs.x, obs.y, obs.radius - 2)) {
      return false;
    }
  }
  return true;
}

/**
 * Line-of-sight check for Mid-Range and Long-Range weapons.
 * Dense Zone geometric walls block ranged shots, making close-range combat shine in tight corridors
 * while Open Zone colonnades give unobstructed long-range sightlines.
 * Active Shroud Snare smoke clouds also break ranged targeting beyond close melee distance.
 */
export function hasLineOfSight(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: Obstacle[],
  hazards: ActiveHazard[] = []
): boolean {
  if (!hasObstacleLineOfSight(x1, y1, x2, y2, obstacles)) {
    return false;
  }

  // Smoke shroud blocks ranged auto-lock when either target or sightline is obscured
  const dist = Math.hypot(x2 - x1, y2 - y1);
  if (dist > 110) {
    for (const hz of hazards) {
      if (segmentIntersectsCircle(x1, y1, x2, y2, hz.x, hz.y, hz.radius * 0.78)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Detect whether a fighter is hugging / taking cover beside any arena block (wall, crate, or pillar).
 * Returns the nearest block surface, outward normal, and gap from fighter edge within `maxGap`.
 */
export function getCoverInfo(
  x: number,
  y: number,
  obstacles: Obstacle[],
  maxGap = 24,
  entityRadius = PLAYER_RADIUS
): CoverInfo | null {
  let best: CoverInfo | null = null;

  for (const obs of obstacles) {
    let contactX = obs.x;
    let contactY = obs.y;
    let normalX = 0;
    let normalY = -1;
    let gap = Infinity;

    if ((obs.kind === 'crate' || obs.kind === 'wall') && obs.w && obs.h) {
      const halfW = obs.w / 2;
      const halfH = obs.h / 2;
      contactX = Math.max(obs.x - halfW, Math.min(x, obs.x + halfW));
      contactY = Math.max(obs.y - halfH, Math.min(y, obs.y + halfH));
      const dx = x - contactX;
      const dy = y - contactY;
      const dist = Math.hypot(dx, dy);
      gap = dist - entityRadius;
      if (dist > 0.001) {
        normalX = dx / dist;
        normalY = dy / dist;
      } else {
        const ax = x - obs.x;
        const ay = y - obs.y;
        const len = Math.hypot(ax, ay) || 1;
        normalX = ax / len;
        normalY = ay / len;
      }
    } else {
      const dx = x - obs.x;
      const dy = y - obs.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      normalX = dx / dist;
      normalY = dy / dist;
      contactX = obs.x + normalX * obs.radius;
      contactY = obs.y + normalY * obs.radius;
      gap = dist - (obs.radius + entityRadius);
    }

    if (gap <= maxGap && (!best || gap < best.gap)) {
      best = {
        obstacle: obs,
        contactX,
        contactY,
        normalX,
        normalY,
        gap: Math.max(0, gap),
      };
    }
  }

  return best;
}

/** Snap a fighter smoothly flush against the nearest arena block surface within `maxSearch` px */
export function snapToNearestCoverBlock(
  x: number,
  y: number,
  obstacles: Obstacle[],
  maxSearch = 64,
  entityRadius = PLAYER_RADIUS
): { x: number; y: number; cover: CoverInfo } | null {
  const info = getCoverInfo(x, y, obstacles, maxSearch, entityRadius);
  if (!info) return null;
  const targetX = info.contactX + info.normalX * (entityRadius + 2);
  const targetY = info.contactY + info.normalY * (entityRadius + 2);
  const resolved = resolveArenaCollisions(targetX, targetY, obstacles, entityRadius);
  return { x: resolved.x, y: resolved.y, cover: info };
}

/**
 * Determine if a fighter tucked against a cover block receives tactical cover damage reduction
 * against an incoming attack from (attackerX, attackerY).
 * Protects against front and oblique flanking angles while leaving pure rear flanks vulnerable.
 */
export function isProtectedByCoverFrom(
  targetX: number,
  targetY: number,
  attackerX: number,
  attackerY: number,
  cover: CoverInfo | null
): boolean {
  if (!cover) return false;
  const toAttackerX = attackerX - targetX;
  const toAttackerY = attackerY - targetY;
  const dist = Math.hypot(toAttackerX, toAttackerY);
  if (dist < 1) return false;
  // cover.normal points from the block OUTWARD toward the fighter.
  // If attacker is on the opposite side of the block (or peeking around the block edge),
  // dot(normal, dirToAttacker) <= 0.45. If attacker walked directly behind the fighter, dot > 0.45.
  const dot = (cover.normalX * toAttackerX + cover.normalY * toAttackerY) / dist;
  return dot <= 0.45;
}

/** Find a tactical cover anchor on the far side of the nearest arena block away from a threat */
export function findTacticalCoverPoint(
  x: number,
  y: number,
  threatX: number,
  threatY: number,
  obstacles: Obstacle[],
  maxSearch = 280
): { x: number; y: number; obstacle: Obstacle } | null {
  let bestObs: Obstacle | null = null;
  let bestDist = maxSearch;

  for (const obs of obstacles) {
    const d = Math.hypot(obs.x - x, obs.y - y);
    if (d < bestDist) {
      bestDist = d;
      bestObs = obs;
    }
  }
  if (!bestObs) return null;

  const awayX = bestObs.x - threatX;
  const awayY = bestObs.y - threatY;
  const len = Math.hypot(awayX, awayY) || 1;
  const ux = awayX / len;
  const uy = awayY / len;

  const offset =
    (bestObs.kind === 'crate' || bestObs.kind === 'wall') && bestObs.w && bestObs.h
      ? Math.max(bestObs.w, bestObs.h) * 0.5 + PLAYER_RADIUS + 6
      : bestObs.radius + PLAYER_RADIUS + 6;

  const resolved = resolveArenaCollisions(
    bestObs.x + ux * offset,
    bestObs.y + uy * offset,
    obstacles
  );
  return { x: resolved.x, y: resolved.y, obstacle: bestObs };
}

/** Returns true if a fighter is concealed inside an active smoke shroud */
export function isInsideSmoke(x: number, y: number, hazards: ActiveHazard[]): boolean {
  for (const hz of hazards) {
    if (Math.hypot(x - hz.x, y - hz.y) <= hz.radius) {
      return true;
    }
  }
  return false;
}

/** Returns strongest movement speed multiplier from active enemy snare fields (1.0 if unaffected) */
export function getSnareSlowMultiplier(
  fighterId: string,
  fighterTeam: 'none' | 'red' | 'blue',
  x: number,
  y: number,
  hazards: ActiveHazard[]
): number {
  let mul = 1;
  for (const hz of hazards) {
    if (hz.ownerId === fighterId) continue;
    if (fighterTeam !== 'none' && hz.ownerTeam === fighterTeam) continue;
    if (Math.hypot(x - hz.x, y - hz.y) <= hz.radius) {
      mul = Math.min(mul, hz.slowFactor);
    }
  }
  return mul;
}

/** Generate evenly distributed spawn positions, optionally clamped safely inside the active zone */
export function getSpawnPosition(
  index: number,
  total: number,
  obstacles: Obstacle[],
  roundNumber = 1,
  safeZone?: { x: number; y: number; radius: number }
): { x: number; y: number } {
  const roundOffset = ((roundNumber - 1) * Math.PI) / 2;
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2 + roundOffset;
  if (safeZone) {
    const dist = Math.min(ARENA_RADIUS * 0.72, Math.max(60, safeZone.radius * 0.66));
    return resolveArenaCollisions(
      safeZone.x + Math.cos(angle) * dist,
      safeZone.y + Math.sin(angle) * dist,
      obstacles
    );
  }
  const dist = ARENA_RADIUS * 0.72;
  return resolveArenaCollisions(Math.cos(angle) * dist, Math.sin(angle) * dist, obstacles);
}

/** Generate opposing team base spawns in TDM, rotating sides cleanly each round and clamping inside active safe zone */
export function getTeamSpawnPosition(
  team: 'red' | 'blue',
  slotIndex: number,
  teamSize: number,
  obstacles: Obstacle[],
  roundNumber = 1,
  safeZone?: { x: number; y: number; radius: number }
): { x: number; y: number } {
  // Rotate team starting flanks 90° each round so teams fight from Dense, Open, Flank, and mixed angles
  const baseAngle = (roundNumber - 1) * (Math.PI / 2) + (team === 'red' ? Math.PI : 0);
  const spread = 0.56;
  const frac = teamSize <= 1 ? 0 : slotIndex / (teamSize - 1) - 0.5;
  const angle = baseAngle + frac * spread;
  if (safeZone) {
    const dist = Math.min(ARENA_RADIUS * 0.74, Math.max(68, safeZone.radius * 0.68));
    return resolveArenaCollisions(
      safeZone.x + Math.cos(angle) * dist,
      safeZone.y + Math.sin(angle) * dist,
      obstacles
    );
  }
  const dist = ARENA_RADIUS * 0.74;
  return resolveArenaCollisions(Math.cos(angle) * dist, Math.sin(angle) * dist, obstacles);
}

/**
 * Compute per-round shrinking safe-zone radius across a timed 45–75s round phase.
 * Gives players genuine loot & positioning time before gradually tightening into the central Sundial Vault.
 */
export function computeZoneState(
  elapsedSec: number,
  roundDurationSec: number,
  arenaRadius: number,
  zoneCenterX: number,
  zoneCenterY: number,
  roundNumber = 1,
  totalRounds = 4
): { zoneRadius: number; zoneTargetRadius: number; phaseLabel: string } {
  const safeDuration = Math.max(roundDurationSec, 30);
  const progress = Math.max(0, Math.min(1, elapsedSec / safeDuration));
  const prefix = `R${roundNumber}/${totalRounds}`;

  if (progress < 0.22) {
    return {
      zoneRadius: arenaRadius,
      zoneTargetRadius: arenaRadius * 0.68,
      phaseLabel: `${prefix} · Safe Zone Open`,
    };
  }
  if (progress < 0.52) {
    const t = (progress - 0.22) / 0.3;
    return {
      zoneRadius: arenaRadius * (1 - 0.32 * t),
      zoneTargetRadius: arenaRadius * 0.68,
      phaseLabel: `${prefix} · Zone Closing`,
    };
  }
  if (progress < 0.65) {
    return {
      zoneRadius: arenaRadius * 0.68,
      zoneTargetRadius: arenaRadius * 0.4,
      phaseLabel: `${prefix} · Vault Contest`,
    };
  }
  if (progress < 0.88) {
    const t = (progress - 0.65) / 0.23;
    return {
      zoneRadius: arenaRadius * (0.68 - 0.28 * t),
      zoneTargetRadius: arenaRadius * 0.4,
      phaseLabel: `${prefix} · Final Showdown`,
    };
  }
  const t = Math.min(1, (progress - 0.88) / 0.12);
  const finalRadius = Math.max(125, arenaRadius * 0.4 * (1 - t) + 125 * t);
  void zoneCenterX;
  void zoneCenterY;
  return {
    zoneRadius: finalRadius,
    zoneTargetRadius: 125,
    phaseLabel: `${prefix} · Final Clash`,
  };
}

/**
 * Zone-purposeful loot spawner (seeded deterministically per round so each of the 4 rounds gets fresh gear):
 * - RESOURCE ZONE (Center Sundial Vault): Spawns the ONLY 2 Rare (Gold) items per round.
 * - DENSE ZONE (Instrument Maze): Highest loot density — Uncommon Close-Range, Utility, Medkits, Shields.
 * - OPEN ZONE (Outer Colonnade): Long-Range Horizon Lances, Mid-Range Carbines, Speed Boosts.
 * - FLANK ZONE (Crossway Bazaar): Mid-Range Carbines, Area Utility Shroud Snares, Power/Shields.
 */
export function generatePickupsForRoom(
  roomId: string,
  seed: number,
  obstacles: Obstacle[],
  roundNumber = 1
): Omit<PickupData, 'claimedBy'>[] {
  const rng = createSeededRng(seed + roundNumber * 7919);
  const result: Omit<PickupData, 'claimedBy'>[] = [];
  let seq = 0;

  const pushPickup = (
    type: PickupType,
    rarity: LootRarity,
    zone: MapZoneId,
    rawX: number,
    rawY: number
  ) => {
    const pos = resolveArenaCollisions(rawX, rawY, obstacles, 28);
    result.push({
      pickupId: `pk_r${roundNumber}_${zone}_${seq++}_${Math.floor(rng() * 10000)}`,
      roomId,
      type,
      rarity,
      zone,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      active: true,
    });
  };

  // 1. RESOURCE ZONE (Center Sundial Vault) — Exactly 2 Rare (Gold) items per match!
  const rarePool: PickupType[] = ['close', 'mid', 'long', 'utility'];
  const firstIdx = Math.floor(rng() * 3); // Guarantee at least 1 primary Gold weapon
  const secondIdx = (firstIdx + 1 + Math.floor(rng() * 3)) % rarePool.length;
  const rareAngle = rng() * Math.PI * 2;
  pushPickup(
    rarePool[firstIdx],
    'rare',
    'resource',
    Math.cos(rareAngle) * 58,
    Math.sin(rareAngle) * 58
  );
  pushPickup(
    rarePool[secondIdx],
    'rare',
    'resource',
    Math.cos(rareAngle + Math.PI) * 58,
    Math.sin(rareAngle + Math.PI) * 58
  );

  // Helper to spawn inside an angular sector & radial band
  const spawnInSector = (
    zone: MapZoneId,
    minDeg: number,
    maxDeg: number,
    minR: number,
    maxR: number,
    items: Array<{ type: PickupType; rarity: LootRarity }>
  ) => {
    items.forEach((item, idx) => {
      const frac = (idx + 0.5) / items.length;
      const deg = minDeg + frac * (maxDeg - minDeg) + (rng() - 0.5) * 14;
      const rad = (deg * Math.PI) / 180;
      const dist = minR + rng() * (maxR - minR);
      pushPickup(item.type, item.rarity, zone, Math.cos(rad) * dist, Math.sin(rad) * dist);
    });
  };

  // 2. DENSE ZONE (Instrument Maze, 140°..265°) — High loot density, favors Close-Range & Utility + sustain
  spawnInSector('dense', 142, 264, 245, 625, [
    { type: 'close', rarity: 'uncommon' },
    { type: 'close', rarity: 'uncommon' },
    { type: 'utility', rarity: 'uncommon' },
    { type: 'mid', rarity: 'uncommon' },
    { type: 'medkit', rarity: 'uncommon' },
    { type: 'shield', rarity: 'uncommon' },
    { type: 'power', rarity: 'uncommon' },
    { type: 'medkit', rarity: 'common' },
  ]);

  // 3. OPEN ZONE (Outer Colonnade, -82°..40°) — Favors Long-Range Horizon Lances + Speed Boosts in exposed lanes
  spawnInSector('open', -80, 38, 255, 635, [
    { type: 'long', rarity: 'uncommon' },
    { type: 'long', rarity: 'uncommon' },
    { type: 'mid', rarity: 'uncommon' },
    { type: 'speed', rarity: 'uncommon' },
    { type: 'speed', rarity: 'common' },
    { type: 'shield', rarity: 'common' },
  ]);

  // 4. FLANK ZONE (Crossway Bazaar, 50°..130°) — Balanced Mid-Range, Utility Shroud Snares, & tactical sustain
  spawnInSector('flank', 52, 128, 250, 610, [
    { type: 'mid', rarity: 'uncommon' },
    { type: 'utility', rarity: 'uncommon' },
    { type: 'close', rarity: 'uncommon' },
    { type: 'shield', rarity: 'uncommon' },
    { type: 'medkit', rarity: 'common' },
    { type: 'power', rarity: 'common' },
  ]);

  return result;
}

/** Mid-round supply drop (spawns at 50% of each timed round to keep 60–75s rounds energetic) */
export function generateMidRoundSupplyDrop(
  roomId: string,
  seed: number,
  obstacles: Obstacle[],
  roundNumber: number
): Omit<PickupData, 'claimedBy'>[] {
  const rng = createSeededRng(seed + roundNumber * 13337 + 99);
  const result: Omit<PickupData, 'claimedBy'>[] = [];
  const rareWeapons: PickupType[] = ['close', 'mid', 'long'];
  const rareType = rareWeapons[Math.floor(rng() * rareWeapons.length)];
  const centerPos = resolveArenaCollisions((rng() - 0.5) * 44, (rng() - 0.5) * 44, obstacles, 28);
  result.push({
    pickupId: `pk_r${roundNumber}_drop_rare_${Math.floor(rng() * 10000)}`,
    roomId,
    type: rareType,
    rarity: 'rare',
    zone: 'resource',
    x: Math.round(centerPos.x),
    y: Math.round(centerPos.y),
    active: true,
  });

  const sustainItems: Array<{ type: PickupType; angleDeg: number }> = [
    { type: 'medkit', angleDeg: 35 },
    { type: 'shield', angleDeg: 125 },
    { type: 'medkit', angleDeg: 215 },
    { type: 'shield', angleDeg: 305 },
  ];
  sustainItems.forEach((item, idx) => {
    const rad = (item.angleDeg * Math.PI) / 180;
    const pos = resolveArenaCollisions(Math.cos(rad) * 240, Math.sin(rad) * 240, obstacles, 26);
    result.push({
      pickupId: `pk_r${roundNumber}_drop_${idx}_${Math.floor(rng() * 10000)}`,
      roomId,
      type: item.type,
      rarity: 'uncommon',
      zone: getMapZoneAt(pos.x, pos.y),
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      active: true,
    });
  });

  return result;
}

/**
 * Closing-Zone Close-Quarters Arsenal Drop:
 * Spawns inside the shrinking safe circle when the fight gets tight so players
 * have immediate close-range weapons, Shroud Snare traps, Power Surge, and Shield
 * to battle enemies right at the end of the zone shrink.
 */
export function generateClosingZoneArsenalDrop(
  roomId: string,
  seed: number,
  obstacles: Obstacle[],
  roundNumber: number,
  zoneCenterX: number,
  zoneCenterY: number,
  zoneRadius: number
): Omit<PickupData, 'claimedBy'>[] {
  const rng = createSeededRng(seed + roundNumber * 29989 + 411);
  const result: Omit<PickupData, 'claimedBy'>[] = [];
  const ringR = Math.max(46, Math.min(zoneRadius * 0.48, 128));

  const arsenal: Array<{ type: PickupType; rarity: LootRarity; angleDeg: number; distMul: number }> = [
    { type: 'close', rarity: 'rare', angleDeg: 20, distMul: 0.72 },
    { type: 'mid', rarity: 'rare', angleDeg: 140, distMul: 0.78 },
    { type: 'utility', rarity: 'rare', angleDeg: 260, distMul: 0.76 },
    { type: 'power', rarity: 'uncommon', angleDeg: 80, distMul: 0.92 },
    { type: 'shield', rarity: 'uncommon', angleDeg: 200, distMul: 0.92 },
    { type: 'medkit', rarity: 'uncommon', angleDeg: 320, distMul: 0.92 },
  ];

  arsenal.forEach((item, idx) => {
    const rad = ((item.angleDeg + (rng() - 0.5) * 24) * Math.PI) / 180;
    const tx = zoneCenterX + Math.cos(rad) * ringR * item.distMul;
    const ty = zoneCenterY + Math.sin(rad) * ringR * item.distMul;
    const pos = resolveArenaCollisions(tx, ty, obstacles, 26);
    result.push({
      pickupId: `pk_r${roundNumber}_closezone_${idx}_${Math.floor(rng() * 10000)}`,
      roomId,
      type: item.type,
      rarity: item.rarity,
      zone: getMapZoneAt(pos.x, pos.y),
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      active: true,
    });
  });

  return result;
}

/** Shortest signed angle difference in radians */
export function lerpAngle(current: number, target: number, alpha: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * alpha;
}

/**
 * Smooth client-side interpolation for 2-5 Hz Firestore remote players.
 */
export function interpolateRemoteFighter(fighter: FighterEntity, dt: number): void {
  const alpha = 1 - Math.exp(-INTERPOLATION_LAMBDA * dt);

  const projectedX = fighter.targetX + fighter.vx * 0.085;
  const projectedY = fighter.targetY + fighter.vy * 0.085;

  const dx = projectedX - fighter.x;
  const dy = projectedY - fighter.y;
  const dist = Math.hypot(dx, dy);

  if (dist > 260) {
    fighter.x = fighter.targetX;
    fighter.y = fighter.targetY;
  } else {
    fighter.x += dx * alpha;
    fighter.y += dy * alpha;
  }

  fighter.facing = lerpAngle(fighter.facing, fighter.targetFacing, Math.min(1, alpha * 1.4));

  const moveSpeed = Math.hypot(fighter.vx, fighter.vy);
  const visualDeltaSpeed = dist / Math.max(dt, 0.016);
  const effectiveSpeed = Math.max(moveSpeed, Math.min(visualDeltaSpeed, 260));

  if (fighter.status === 'downed') {
    fighter.animState = 'downed';
  } else if (effectiveSpeed > 18) {
    fighter.animPhase += dt * (effectiveSpeed / 26);
    if (fighter.attackTimer <= 0 && fighter.hitFlashTimer <= 0) {
      fighter.animState = effectiveSpeed > 235 ? 'run' : 'walk';
    }
  } else {
    fighter.animPhase += dt * 2.2;
    if (fighter.attackTimer <= 0 && fighter.hitFlashTimer <= 0) {
      fighter.animState = 'idle';
    }
  }
}
