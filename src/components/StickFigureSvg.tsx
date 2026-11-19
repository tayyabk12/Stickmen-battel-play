import React from 'react';
import {
  RARITY_META,
  TEAM_META,
  type AccessoryType,
  type AnimState,
  type LootRarity,
  type TeamId,
  type WeaponCategory,
} from '../types/game';

interface StickFigureProps {
  x: number;
  y: number;
  color: string;
  accessory: AccessoryType;
  animState: AnimState;
  animPhase: number;
  facing: number;
  health: number;
  shield: number;
  displayName?: string;
  team?: TeamId;
  spawnShield?: boolean;
  isLocal?: boolean;
  hitFlash?: boolean;
  speedBoost?: boolean;
  damageBoost?: boolean;
  snared?: boolean;
  concealed?: boolean;
  inCover?: boolean;
  weaponCategory?: WeaponCategory;
  weaponRarity?: LootRarity;
  weaponLevel?: number;
  streak?: number;
  overdriveReady?: boolean;
  stale?: boolean;
  scale?: number;
  showHud?: boolean;
}

/**
 * Renders the equipped cosmetic accessory anchored directly to the stick-figure's moving head joint.
 * Designed with clean vector geometry so the exact same joint offsets port 1:1 to Jetpack Compose Canvas.
 */
function AccessorySvg({
  accessory,
  headX,
  headY,
}: {
  accessory: AccessoryType;
  headX: number;
  headY: number;
}) {
  if (accessory === 'none') return null;

  return (
    <g transform={`translate(${headX}, ${headY})`}>
      {accessory === 'crown' && (
        <polygon
          points="-7,-7 -6,-15 -2,-11 0,-16 2,-11 6,-15 7,-7"
          fill="#FBBF24"
          stroke="#111827"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      )}
      {accessory === 'headband' && (
        <g>
          <line x1="-8" y1="-3" x2="8" y2="-3" stroke="#F43F5E" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M 7,-3 L 14,-6 M 7,-2 L 13,1" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {accessory === 'horns' && (
        <g>
          <path d="M -5,-6 Q -12,-14 -7,-16 Q -4,-12 -2,-7" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1.2" />
          <path d="M 5,-6 Q 12,-14 7,-16 Q 4,-12 2,-7" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1.2" />
        </g>
      )}
      {accessory === 'halo' && (
        <ellipse
          cx="0"
          cy="-13"
          rx="8"
          ry="2.6"
          fill="none"
          stroke="#FDE047"
          strokeWidth="2.2"
        />
      )}
      {accessory === 'tophat' && (
        <g>
          <rect x="-10" y="-8.5" width="20" height="2.4" rx="1" fill="#1E293B" stroke="#E2E8F0" strokeWidth="0.9" />
          <rect x="-6.5" y="-17.5" width="13" height="9.5" rx="1.2" fill="#0F172A" stroke="#E2E8F0" strokeWidth="0.9" />
          <rect x="-6.5" y="-10.8" width="13" height="2" fill="#EF4444" />
        </g>
      )}
      {accessory === 'mohawk' && (
        <path
          d="M -3,-8 L -5,-15 L -1,-13 L 1,-17 L 4,-13 L 7,-14 L 5,-7 Z"
          fill="#F97316"
          stroke="#111827"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      )}
      {accessory === 'shades' && (
        <g>
          <rect x="-7" y="-2.5" width="6" height="4" rx="1" fill="#0F172A" stroke="#94A3B8" strokeWidth="0.9" />
          <rect x="1" y="-2.5" width="6" height="4" rx="1" fill="#0F172A" stroke="#94A3B8" strokeWidth="0.9" />
          <line x1="-1" y1="-0.8" x2="1" y2="-0.8" stroke="#94A3B8" strokeWidth="1.2" />
        </g>
      )}
    </g>
  );
}

/** Renders a detailed tactical graphic firearm in the fighter's front hand, evolving with rarity & upgrade level */
function HeldWeaponSvg({
  category,
  rarity,
  weaponLevel,
  handX,
  handY,
  isAttacking,
}: {
  category: WeaponCategory;
  rarity: LootRarity;
  weaponLevel: number;
  handX: number;
  handY: number;
  isAttacking: boolean;
}) {
  const accent = weaponLevel >= 5 ? '#FACC15' : RARITY_META[rarity].color;
  const bodyColor = weaponLevel >= 5 ? '#1E293B' : '#1E293B';
  const recoilX = isAttacking ? -2.2 : 0;
  const rot = isAttacking ? (category === 'close' ? -15 : -8) : 4;

  return (
    <g transform={`translate(${handX + recoilX}, ${handY}) rotate(${rot})`}>
      {category === 'close' && (
        <g stroke="#090D14" strokeLinecap="round" strokeLinejoin="round">
          {/* Viper Scattergun: stock, receiver, twin barrels, pump grip */}
          <path d="M -8,2 L -1,0 L -1,3.6 L -7,5 Z" fill="#0F172A" strokeWidth="1.2" />
          <rect x="-2" y="-3.2" width="12" height="5.2" rx="1.1" fill={bodyColor} strokeWidth="1.4" />
          <rect x="9" y="-3.4" width="12" height="2.4" rx="0.6" fill="#475569" strokeWidth="1.1" />
          <rect x="9" y="-0.6" width="10" height="2.4" rx="0.6" fill="#0F172A" stroke={accent} strokeWidth="1" />
          <line x1="1" y1="-1" x2="7" y2="-1" stroke={accent} strokeWidth="1.8" />
          {weaponLevel >= 3 && (
            <rect x="1.5" y="-5.4" width="5.5" height="2.2" rx="0.6" fill={accent} strokeWidth="0.9" />
          )}
          {weaponLevel >= 4 && (
            <rect x="19" y="-4" width="3.5" height="4.2" rx="0.6" fill={accent} strokeWidth="0.9" />
          )}
        </g>
      )}
      {category === 'mid' && (
        <g stroke="#090D14" strokeLinecap="round" strokeLinejoin="round">
          {/* Pulse Carbine SMG: tactical stock, receiver, curved mag, compensator */}
          <rect x="-8" y="-2" width="6" height="3.6" rx="0.8" fill="#0F172A" strokeWidth="1.1" />
          <path d="M 4,1.5 L 7.5,1.5 L 9.2,7.5 L 5.6,7.8 Z" fill="#0F172A" stroke={accent} strokeWidth="1.1" />
          <rect x="-3" y="-3.6" width="17" height="5" rx="1.1" fill={bodyColor} strokeWidth="1.4" />
          <line x1="0" y1="-1.2" x2="11" y2="-1.2" stroke={accent} strokeWidth="1.8" />
          <rect x="13.5" y="-2.2" width="6.5" height="2.5" rx="0.6" fill="#475569" strokeWidth="1.1" />
          {weaponLevel >= 3 && (
            <rect x="2" y="-6.2" width="6.5" height="2.5" rx="0.7" fill={accent} strokeWidth="0.9" />
          )}
          {weaponLevel >= 4 && (
            <rect x="18.5" y="-2.8" width="4.5" height="3.6" rx="0.7" fill="#0F172A" stroke={accent} strokeWidth="1" />
          )}
        </g>
      )}
      {category === 'long' && (
        <g stroke="#090D14" strokeLinecap="round" strokeLinejoin="round">
          {/* Horizon Rail Sniper: skeletal stock, magnified scope, twin glowing rail barrel */}
          <path d="M -10,-1.5 L -2,-2.5 L -2,2 L -9,3.2 Z" fill="#0F172A" strokeWidth="1.2" />
          <rect x="-3" y="-3.4" width="13" height="4.8" rx="1" fill={bodyColor} strokeWidth="1.4" />
          <line x1="9" y1="-2.2" x2="27" y2="-2.2" stroke="#475569" strokeWidth="2.4" />
          <line x1="9" y1="0.2" x2="25" y2="0.2" stroke="#1E293B" strokeWidth="2.2" />
          <line x1="10" y1="-1" x2="27" y2="-1" stroke={accent} strokeWidth="1.7" />
          {/* Sniper Scope */}
          <rect x="0" y="-6.8" width="10.5" height="2.9" rx="0.9" fill="#0F172A" stroke={accent} strokeWidth="1.1" />
          <circle cx="10.5" cy="-5.3" r="1.2" fill={accent} stroke="none" />
          {weaponLevel >= 4 && (
            <g stroke={accent} strokeWidth="1.3">
              <line x1="15" y1="-3.4" x2="15" y2="1.4" />
              <line x1="21" y1="-3.4" x2="21" y2="1.4" />
            </g>
          )}
        </g>
      )}
    </g>
  );
}

/**
 * Procedural Joint-Based SVG Stick Figure.
 * Computes shoulder, elbow, hand, hip, knee, and foot joint positions mathematically
 * from (animState, animPhase, facing) for fluid walk, run, attack, hit, and downed poses.
 */
export const StickFigureSvg: React.FC<StickFigureProps> = React.memo(
  ({
    x,
    y,
    color,
    accessory,
    animState,
    animPhase,
    facing,
    health,
    shield,
    displayName,
    team = 'none',
    spawnShield = false,
    isLocal = false,
    hitFlash = false,
    speedBoost = false,
    damageBoost = false,
    snared = false,
    concealed = false,
    inCover = false,
    weaponCategory = 'close',
    weaponRarity = 'common',
    weaponLevel = 1,
    streak = 0,
    overdriveReady = false,
    stale = false,
    scale = 1,
    showHud = true,
  }) => {
    const faceDir = Math.cos(facing) >= 0 ? 1 : -1;
    const isDowned = animState === 'downed';
    const isAttacking = animState === 'attack';
    const isHit = animState === 'hit' || hitFlash;
    const isRunning = animState === 'run';
    const isWalking = animState === 'walk';
    const isCrouched = inCover && !isDowned && !isAttacking;

    // Procedural joint solver
    const stride = isRunning ? 1.0 : isWalking ? 0.65 : 0;
    const sinA = Math.sin(animPhase);
    const cosA = Math.cos(animPhase);
    const bob = isDowned ? 0 : stride > 0 ? Math.abs(cosA) * (isRunning ? -3.8 : -2.2) : Math.sin(animPhase) * 0.8;
    const crouchDrop = isCrouched ? (stride > 0 ? 3.5 : 6.2) : 0;
    const torsoLean = isDowned
      ? 0
      : isRunning
        ? 5.5
        : isWalking
          ? 2.5
          : isAttacking
            ? 6
            : isHit
              ? -5
              : isCrouched
                ? 4.2
                : 0;

    // Hip & Shoulder joints (in local stick-figure coordinates, facing right; flipped via scaleX(faceDir))
    const hipX = isCrouched ? -2 : 0;
    const hipY = 5 + bob * 0.4 + crouchDrop;
    const shoulderX = torsoLean;
    const shoulderY = -12 + bob + crouchDrop * 1.05;
    const headX = torsoLean + (isAttacking ? 1.5 : isCrouched ? 1.2 : 0);
    const headY = -21 + bob + crouchDrop * 1.1;

    // Legs (2-segment hip -> knee -> foot)
    const legSwing = stride > 0 ? sinA * (isRunning ? 12 : 8.5) : 0;
    const legLift1 = stride > 0 ? Math.max(0, -cosA) * (isRunning ? 5.5 : 3) : 0;
    const legLift2 = stride > 0 ? Math.max(0, cosA) * (isRunning ? 5.5 : 3) : 0;

    const knee1X = hipX + legSwing * 0.65 + (stride > 0 ? 2 : isCrouched ? 5.5 : -2);
    const knee1Y = hipY + (isCrouched ? 5.2 : 7) - legLift1 * 0.6;
    const foot1X = hipX + legSwing - (stride > 0 ? 1 : isCrouched ? -3 : 4.5);
    const foot1Y = 19.5 - legLift1;

    const knee2X = hipX - legSwing * 0.65 + (stride > 0 ? 2 : isCrouched ? -4.5 : 2);
    const knee2Y = hipY + (isCrouched ? 5.8 : 7) - legLift2 * 0.6;
    const foot2X = hipX - legSwing + (stride > 0 ? 1 : isCrouched ? -6.5 : 4.5);
    const foot2Y = 19.5 - legLift2;

    // Arms (2-segment shoulder -> elbow -> hand)
    const armSwing = stride > 0 ? -sinA * (isRunning ? 11 : 7) : 0;
    let elbow1X = shoulderX + armSwing * 0.55 + (isCrouched ? 4.5 : 2);
    let elbow1Y = shoulderY + (isCrouched ? 4.5 : 6.5);
    let hand1X = shoulderX + armSwing + (isCrouched ? 8.5 : 5);
    let hand1Y = shoulderY + (isCrouched ? 5.5 : 10.5) - (isRunning ? 3 : 0);

    let elbow2X = shoulderX - armSwing * 0.55 - 2;
    let elbow2Y = shoulderY + (isCrouched ? 5 : 6.5);
    let hand2X = shoulderX - armSwing + (isCrouched ? 3.5 : -5);
    let hand2Y = shoulderY + (isCrouched ? 6.5 : 11);

    if (isAttacking) {
      elbow1X = shoulderX + 10;
      elbow1Y = shoulderY + 1;
      hand1X = shoulderX + 21;
      hand1Y = shoulderY - 2;
      elbow2X = shoulderX - 7;
      elbow2Y = shoulderY + 5;
      hand2X = shoulderX - 10;
      hand2Y = shoulderY + 10;
    } else if (isHit) {
      elbow1X = shoulderX - 7;
      elbow1Y = shoulderY - 2;
      hand1X = shoulderX - 11;
      hand1Y = shoulderY - 8;
      elbow2X = shoulderX + 6;
      elbow2Y = shoulderY - 1;
      hand2X = shoulderX + 11;
      hand2Y = shoulderY - 7;
    }

    const strokeColor = isHit ? '#FFFFFF' : color;
    const squashX = isHit ? 1.12 : isAttacking ? 1.07 : isCrouched ? 1.04 : 1;
    const squashY = isHit ? 0.9 : isAttacking ? 0.96 : 1;
    const teamColor = team !== 'none' ? TEAM_META[team].color : null;

    return (
      <g
        transform={`translate(${x}, ${y}) scale(${scale})`}
        opacity={stale ? 0.42 : isDowned ? 0.55 : concealed ? 0.45 : 1}
      >
        {/* Ground shadow */}
        <ellipse
          cx="0"
          cy={isDowned ? 12 : 19}
          rx={isDowned ? 18 : 13}
          ry={isDowned ? 6 : 4.5}
          fill="#06090E"
          opacity="0.52"
        />

        {/* TDM Team Ground Halo */}
        {teamColor && !isDowned && (
          <ellipse
            cx="0"
            cy="19"
            rx="19"
            ry="7.2"
            fill={`${teamColor}26`}
            stroke={teamColor}
            strokeWidth="2.1"
            opacity="0.9"
          />
        )}

        {/* Local player selection ring */}
        {isLocal && !isDowned && (
          <ellipse
            cx="0"
            cy="19"
            rx={teamColor ? 23 : 17}
            ry={teamColor ? 8.8 : 6.5}
            fill="none"
            stroke="#F8FAFC"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.75"
          />
        )}

        {/* Brief Respawn Invulnerability Halo */}
        {spawnShield && !isDowned && (
          <circle
            cx="0"
            cy="-2"
            r="31"
            fill="rgba(248, 250, 252, 0.12)"
            stroke="#F8FAFC"
            strokeWidth="2"
            strokeDasharray="6 4"
            opacity="0.88"
          />
        )}

        {/* Active Pickup Auras */}
        {speedBoost && !isDowned && (
          <circle
            cx="0"
            cy="0"
            r="26"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="2"
            strokeDasharray="6 4"
            opacity="0.8"
          />
        )}
        {damageBoost && !isDowned && (
          <circle
            cx="0"
            cy="0"
            r="29"
            fill="none"
            stroke="#F97316"
            strokeWidth="2"
            strokeDasharray="5 5"
            opacity="0.85"
          />
        )}
        {shield > 0 && !isDowned && (
          <circle
            cx="0"
            cy="-2"
            r="23"
            fill="rgba(56, 189, 248, 0.1)"
            stroke="#38BDF8"
            strokeWidth="1.6"
            opacity="0.75"
          />
        )}
        {snared && !isDowned && (
          <ellipse
            cx="0"
            cy="19"
            rx="20"
            ry="7.5"
            fill="rgba(168, 85, 247, 0.18)"
            stroke="#C084FC"
            strokeWidth="2"
            strokeDasharray="5 3"
          />
        )}

        {/* Tactical Block Cover Shield Ring */}
        {inCover && !isDowned && (
          <g pointerEvents="none">
            <ellipse
              cx="0"
              cy="19"
              rx="21"
              ry="7.8"
              fill="rgba(16, 185, 129, 0.16)"
              stroke="#10B981"
              strokeWidth="2.2"
              opacity="0.95"
            />
          </g>
        )}

        {/* Killstreak Blazing Golden Aura (2+ consecutive KOs) */}
        {streak >= 2 && !isDowned && (
          <circle
            cx="0"
            cy="-2"
            r={streak >= 3 ? 33 : 28}
            fill="rgba(250, 204, 21, 0.08)"
            stroke={streak >= 3 ? '#FACC15' : '#FB923C'}
            strokeWidth={streak >= 3 ? 2.4 : 1.8}
            strokeDasharray="8 5"
            opacity="0.88"
          />
        )}

        {/* Overdrive Nova Charged Electric Ring */}
        {overdriveReady && !isDowned && (
          <ellipse
            cx="0"
            cy="19"
            rx="25"
            ry="9.5"
            fill="rgba(56, 189, 248, 0.14)"
            stroke="#38BDF8"
            strokeWidth="2.2"
            strokeDasharray="6 3"
            opacity="0.92"
          />
        )}

        {/* Stick-Figure Skeleton */}
        {isDowned ? (
          <g transform="translate(0, 10) rotate(-82)">
            <g stroke="#0B0F17" strokeWidth="6.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <line x1="0" y1="-12" x2="0" y2="5" />
              <line x1="0" y1="-8" x2="-10" y2="-1" />
              <line x1="0" y1="-8" x2="10" y2="-2" />
              <line x1="0" y1="5" x2="-7" y2="17" />
              <line x1="0" y1="5" x2="6" y2="16" />
              <circle cx="0" cy="-20" r="7.5" fill="#0B0F17" />
            </g>
            <g stroke={color} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <line x1="0" y1="-12" x2="0" y2="5" />
              <line x1="0" y1="-8" x2="-10" y2="-1" />
              <line x1="0" y1="-8" x2="10" y2="-2" />
              <line x1="0" y1="5" x2="-7" y2="17" />
              <line x1="0" y1="5" x2="6" y2="16" />
              <circle cx="0" cy="-20" r="7.5" fill="#1E293B" />
            </g>
            {/* X eyes */}
            <path d="M -3,-22 L -1,-20 M -1,-22 L -3,-20 M 1,-22 L 3,-20 M 3,-22 L 1,-20" stroke="#F8FAFC" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        ) : (
          <g transform={`scale(${faceDir * squashX}, ${squashY})`}>
            {/* High-contrast dark outer outline so stick figures pop over concrete */}
            <g stroke="#090D14" strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <polyline points={`${hipX},${hipY} ${knee2X},${knee2Y} ${foot2X},${foot2Y}`} />
              <polyline points={`${shoulderX},${shoulderY} ${elbow2X},${elbow2Y} ${hand2X},${hand2Y}`} />
              <line x1={shoulderX} y1={shoulderY} x2={hipX} y2={hipY} />
              <polyline points={`${hipX},${hipY} ${knee1X},${knee1Y} ${foot1X},${foot1Y}`} />
              <polyline points={`${shoulderX},${shoulderY} ${elbow1X},${elbow1Y} ${hand1X},${hand1Y}`} />
              <circle cx={headX} cy={headY} r="8" fill="#090D14" />
            </g>

            {/* Primary colored limbs */}
            <g stroke={strokeColor} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
              {/* Back leg & arm (slightly dimmer for depth) */}
              <polyline points={`${hipX},${hipY} ${knee2X},${knee2Y} ${foot2X},${foot2Y}`} opacity="0.82" />
              <polyline points={`${shoulderX},${shoulderY} ${elbow2X},${elbow2Y} ${hand2X},${hand2Y}`} opacity="0.82" />
              {/* Spine */}
              <line x1={shoulderX} y1={shoulderY} x2={hipX} y2={hipY} />
              {/* Front leg */}
              <polyline points={`${hipX},${hipY} ${knee1X},${knee1Y} ${foot1X},${foot1Y}`} />
              {/* Front arm */}
              <polyline points={`${shoulderX},${shoulderY} ${elbow1X},${elbow1Y} ${hand1X},${hand1Y}`} />
            </g>

            {/* Held Graphic Firearm */}
            <HeldWeaponSvg
              category={weaponCategory}
              rarity={weaponRarity}
              weaponLevel={weaponLevel}
              handX={hand1X}
              handY={hand1Y}
              isAttacking={isAttacking}
            />

            {/* Crisp Jagged Muzzle Flash Burst */}
            {isAttacking && (
              <g
                transform={`translate(${
                  hand1X + (weaponCategory === 'long' ? 26 : weaponCategory === 'mid' ? 20 : 19)
                }, ${hand1Y - (weaponCategory === 'close' ? 4 : 2)})`}
              >
                <polygon
                  points="0,-7 3,-2.5 10,-4 4.5,0 11,3.5 3,2.5 0,7 -2,2 -5,0 -2,-2"
                  fill={damageBoost ? '#F97316' : weaponLevel >= 5 ? '#FACC15' : RARITY_META[weaponRarity].color}
                  stroke="#0F172A"
                  strokeWidth="0.9"
                />
                <circle cx="1" cy="0" r="2.6" fill="#FFFFFF" />
              </g>
            )}

            {/* Head */}
            <circle
              cx={headX}
              cy={headY}
              r="7.6"
              fill={isHit ? '#FFFFFF' : '#111827'}
              stroke={strokeColor}
              strokeWidth="3.1"
            />
            {/* Expressive eyes facing forward */}
            <circle cx={headX + 2.5} cy={headY - 0.8} r="1.35" fill="#F8FAFC" />
            <circle cx={headX + 5.1} cy={headY - 0.8} r="1.2" fill="#F8FAFC" />

            {/* Equipped Accessory */}
            <AccessorySvg accessory={accessory} headX={headX} headY={headY} />
          </g>
        )}

        {/* Overhead Nameplate + Compact Health/Shield Micro-Bar */}
        {showHud && !isDowned && (
          <g transform="translate(0, -40)">
            {displayName && (
              <text
                x="0"
                y="-8"
                textAnchor="middle"
                fill={
                  isLocal
                    ? '#FFFFFF'
                    : team === 'red'
                      ? '#FCA5A5'
                      : team === 'blue'
                        ? '#93C5FD'
                        : '#CBD5E1'
                }
                stroke="#0B0F17"
                strokeWidth="3"
                paintOrder="stroke"
                fontSize="10.5"
                fontWeight="700"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                {team === 'red' ? '[R] ' : team === 'blue' ? '[B] ' : ''}
                {displayName}
                {streak >= 2 ? ` ★${streak}` : ''}
              </text>
            )}
            {/* Health bar track */}
            <rect x="-20" y="-3" width="40" height="4.5" rx="2" fill="#0B0F17" stroke="#334155" strokeWidth="0.7" />
            <rect
              x="-19.5"
              y="-2.5"
              width={Math.max(0, Math.min(39, (health / 100) * 39))}
              height="3.5"
              rx="1.5"
              fill={health > 50 ? '#10B981' : health > 25 ? '#F59E0B' : '#EF4444'}
            />
            {shield > 0 && (
              <rect
                x="-19.5"
                y="-5.8"
                width={Math.max(0, Math.min(39, (shield / 50) * 39))}
                height="2.2"
                rx="1"
                fill="#38BDF8"
              />
            )}
            {inCover && (
              <g transform="translate(26, -1.5)" pointerEvents="none">
                <path
                  d="M 0,-5.5 L 5,-3.2 V 1.2 C 5,4.2 0,6.5 0,6.5 C 0,6.5 -5,4.2 -5,1.2 V -3.2 Z"
                  fill="#10B981"
                  stroke="#090D14"
                  strokeWidth="1.4"
                />
              </g>
            )}
          </g>
        )}
      </g>
    );
  }
);

StickFigureSvg.displayName = 'StickFigureSvg';

/** Live animated stick-figure preview used in the Customizer and Lobby roster */
export const StickFigurePreview: React.FC<{
  color: string;
  accessory: AccessoryType;
  animState?: AnimState;
  size?: number;
}> = ({ color, accessory, animState = 'walk', size = 84 }) => {
  const [phase, setPhase] = React.useState(0);

  React.useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      setPhase((p) => p + dt * (animState === 'run' ? 11 : animState === 'walk' ? 7 : 3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animState]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="-36 -44 72 76"
      className="overflow-visible select-none"
      aria-hidden="true"
    >
      <StickFigureSvg
        x={0}
        y={4}
        color={color}
        accessory={accessory}
        animState={animState}
        animPhase={phase}
        facing={0}
        health={100}
        shield={0}
        showHud={false}
        scale={1.15}
      />
    </svg>
  );
};
