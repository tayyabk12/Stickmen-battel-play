import React from 'react';
import {
  getGunUpgradeTier,
  RARITY_META,
  type LootRarity,
  type WeaponCategory,
} from '../types/game';

interface WeaponGraphicProps {
  category: WeaponCategory;
  upgradeLevel?: number;
  rarity?: LootRarity;
  className?: string;
  compact?: boolean;
  width?: number;
  height?: number;
}

/**
 * High-detail vector graphic firearm renderer for Armory showcase, HUD weapon cards,
 * and arena floor pickups. Visually evolves across MK-I (Lv.1) to MK-V (Lv.5) tiers.
 */
export const WeaponGraphicSvg: React.FC<WeaponGraphicProps> = ({
  category,
  upgradeLevel = 1,
  rarity,
  className = 'w-full h-auto',
  compact = false,
  width,
  height,
}) => {
  const tier = getGunUpgradeTier(upgradeLevel);
  const accent = rarity ? RARITY_META[rarity].color : tier.accent;
  const isMasterwork = upgradeLevel >= 5;
  const trimStroke = isMasterwork ? '#FACC15' : accent;
  const bodyPrimary = isMasterwork ? '#1F2430' : '#1E293B';
  const bodySecondary = '#334155';
  const bodyDark = '#0F172A';
  const metalHighlight = isMasterwork ? '#FDE047' : '#94A3B8';
  const uid = React.useId().replace(/:/g, '');

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 220 84"
      className={`${className} select-none overflow-visible`}
      role="img"
      aria-label={`${category} graphic firearm MK-${upgradeLevel}`}
    >
      <defs>
        <linearGradient id={`metal_${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isMasterwork ? '#475569' : '#475569'} />
          <stop offset="48%" stopColor={bodyPrimary} />
          <stop offset="100%" stopColor={bodyDark} />
        </linearGradient>
        <linearGradient id={`accent_${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={trimStroke} stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id={`glow_${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={trimStroke} stopOpacity="0.34" />
          <stop offset="100%" stopColor={trimStroke} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Subtle Energy Under-Glow for upgraded / rare guns */}
      {!compact && (upgradeLevel >= 3 || rarity === 'rare') && (
        <ellipse cx="116" cy="44" rx="88" ry="26" fill={`url(#glow_${uid})`} />
      )}

      {/* ==================== CLOSE-RANGE: VIPER SCATTERGUN ==================== */}
      {category === 'close' && (
        <g stroke="#090D14" strokeLinejoin="round" strokeLinecap="round">
          {/* Heavy Tactical Buttstock */}
          <path
            d="M 16,42 L 54,34 L 58,47 L 28,60 L 14,57 Z"
            fill={`url(#metal_${uid})`}
            strokeWidth="2.2"
          />
          <rect x="13" y="42" width="6" height="16" rx="1.5" fill="#0F172A" strokeWidth="1.6" />
          {/* Angled Pistol Grip + Trigger Guard */}
          <path d="M 55,44 L 68,44 L 62,67 L 48,66 Z" fill={bodyDark} strokeWidth="2" />
          <path d="M 67,46 L 80,46 L 78,55 L 65,55" fill="none" stroke={bodySecondary} strokeWidth="2.2" />
          <line x1="72" y1="47" x2="70" y2="52" stroke={metalHighlight} strokeWidth="1.8" />

          {/* Main Heavy Shotgun Receiver */}
          <path
            d="M 54,31 L 122,31 L 126,35 L 126,47 L 54,47 Z"
            fill={`url(#metal_${uid})`}
            strokeWidth="2.2"
          />
          {/* Ejection Port & Shell Bolt */}
          <rect x="82" y="34" width="22" height="7" rx="1.5" fill="#090D14" strokeWidth="1.2" />
          <rect x="86" y="35.5" width="13" height="4" rx="0.8" fill={trimStroke} stroke="none" />

          {/* Twin Over-Under Barrels */}
          <rect x="122" y="30" width="76" height="7.5" rx="1.5" fill={bodySecondary} strokeWidth="2" />
          <rect x="122" y="38.5" width={upgradeLevel >= 3 ? 72 : 62} height="6.5" rx="1.5" fill={bodyPrimary} strokeWidth="2" />

          {/* Ribbed Under-Barrel Pump Forend */}
          <rect x="128" y="39" width="40" height="11" rx="2.5" fill={bodyDark} stroke={trimStroke} strokeWidth="1.8" />
          {[134, 140, 146, 152, 158, 164].map((gx) => (
            <line key={gx} x1={gx} y1="40.5" x2={gx} y2="48.5" stroke={metalHighlight} strokeWidth="1.4" opacity="0.65" />
          ))}

          {/* Top Rail */}
          <line x1="60" y1="30" x2="118" y2="30" stroke={metalHighlight} strokeWidth="2.2" />

          {/* Lv 2+: Heat Shield Vents & Fiber Front Sight */}
          {upgradeLevel >= 2 && (
            <g>
              <rect x="126" y="29" width="38" height="3.2" rx="1" fill={trimStroke} stroke="none" opacity="0.85" />
              <polygon points="190,29 194,24 196,29" fill={trimStroke} strokeWidth="1.2" />
            </g>
          )}

          {/* Lv 3+: Compact Reflex Optic */}
          {upgradeLevel >= 3 && (
            <g>
              <rect x="74" y="21" width="24" height="9.5" rx="2" fill={bodyDark} stroke={trimStroke} strokeWidth="1.6" />
              <line x1="80" y1="25.5" x2="92" y2="25.5" stroke={trimStroke} strokeWidth="2" />
            </g>
          )}

          {/* Lv 4+: Heavy Breacher Choke Brake & Plasma Coils */}
          {upgradeLevel >= 4 && (
            <g>
              <rect x="195" y="28.5" width="14" height="11" rx="1.5" fill={bodyDark} stroke={trimStroke} strokeWidth="1.8" />
              <line x1="199" y1="30.5" x2="199" y2="37.5" stroke={trimStroke} strokeWidth="1.8" />
              <line x1="204" y1="30.5" x2="204" y2="37.5" stroke={trimStroke} strokeWidth="1.8" />
              <line x1="60" y1="41" x2="77" y2="41" stroke={`url(#accent_${uid})`} strokeWidth="2.6" />
            </g>
          )}

          {/* Lv 5: Masterwork Gold Trim Crest */}
          {isMasterwork && (
            <path d="M 58,33 L 76,33 L 72,38 L 58,38 Z" fill="#FACC15" stroke="none" opacity="0.9" />
          )}
        </g>
      )}

      {/* ==================== MID-RANGE: PULSE CARBINE SMG ==================== */}
      {category === 'mid' && (
        <g stroke="#090D14" strokeLinejoin="round" strokeLinecap="round">
          {/* Collapsible Tactical Stock */}
          <path
            d="M 18,34 L 54,34 L 54,46 L 28,46 L 24,54 L 16,54 Z"
            fill={bodyDark}
            strokeWidth="2"
          />
          <rect x="24" y="38" width="24" height="4.5" rx="1" fill={bodySecondary} stroke="none" />

          {/* Rear Pistol Grip */}
          <path d="M 57,46 L 69,46 L 63,68 L 50,67 Z" fill={bodyDark} strokeWidth="2" />
          <path d="M 68,47 L 82,47 L 80,55 L 66,55" fill="none" stroke={bodySecondary} strokeWidth="2" />

          {/* Curved Tactical Magazine */}
          <path
            d="M 98,46 L 113,46 L 119,70 L 104,72 Z"
            fill={bodyPrimary}
            stroke={trimStroke}
            strokeWidth="1.8"
          />
          <line x1="104" y1="53" x2="112" y2="53" stroke={trimStroke} strokeWidth="1.6" />
          <line x1="106" y1="60" x2="114" y2="60" stroke={trimStroke} strokeWidth="1.6" />

          {/* Main Carbine Upper & Lower Receiver */}
          <path
            d="M 52,29 L 154,29 L 158,34 L 158,47 L 52,47 Z"
            fill={`url(#metal_${uid})`}
            strokeWidth="2.2"
          />

          {/* Shrouded Handguard Vent Slots */}
          {[122, 130, 138, 146].map((vx) => (
            <rect key={vx} x={vx} y="34" width="4.5" height="8" rx="1" fill="#090D14" stroke="none" />
          ))}

          {/* Glowing Energy Pulse Strip */}
          <rect x="62" y="35" width="48" height="4.5" rx="1.2" fill={trimStroke} stroke="none" opacity="0.9" />

          {/* Barrel & Muzzle Compensator */}
          <rect x="158" y="34" width={upgradeLevel >= 4 ? 46 : 34} height="6.5" rx="1.5" fill={bodySecondary} strokeWidth="2" />
          <rect
            x={upgradeLevel >= 4 ? 194 : 186}
            y="32.5"
            width={upgradeLevel >= 4 ? 16 : 10}
            height="9.5"
            rx="1.5"
            fill={bodyDark}
            stroke={trimStroke}
            strokeWidth="1.8"
          />

          {/* Lv 2+: Tactical Angled Foregrip */}
          {upgradeLevel >= 2 && (
            <path d="M 126,47 L 144,47 L 136,59 L 125,56 Z" fill={bodyDark} stroke={trimStroke} strokeWidth="1.6" />
          )}

          {/* Lv 3+: Holographic Reflex Sight */}
          {upgradeLevel >= 3 && (
            <g>
              <path d="M 74,29 L 78,18 L 106,18 L 110,29 Z" fill={bodyDark} stroke={trimStroke} strokeWidth="1.8" />
              <rect x="82" y="21" width="20" height="5" rx="1" fill={trimStroke} stroke="none" opacity="0.85" />
            </g>
          )}

          {/* Lv 4+: Overcharged Barrel Core Coils */}
          {upgradeLevel >= 4 && (
            <g>
              <line x1="164" y1="37.2" x2="190" y2="37.2" stroke={`url(#accent_${uid})`} strokeWidth="2.8" />
              <circle cx="114" cy="37.2" r="2.5" fill="#FFFFFF" stroke="none" />
            </g>
          )}

          {/* Lv 5: Masterwork Gold Rail Accent */}
          {isMasterwork && (
            <rect x="56" y="27.5" width="94" height="2.6" rx="1" fill="#FACC15" stroke="none" />
          )}
        </g>
      )}

      {/* ==================== LONG-RANGE: HORIZON RAIL SNIPER ==================== */}
      {category === 'long' && (
        <g stroke="#090D14" strokeLinejoin="round" strokeLinecap="round">
          {/* Precision Skeletal Sniper Stock */}
          <path
            d="M 8,36 L 52,33 L 52,47 L 26,56 L 8,55 Z"
            fill={`url(#metal_${uid})`}
            strokeWidth="2.2"
          />
          <polygon points="18,43 44,39 44,45 22,50" fill="#090D14" stroke="none" />
          {/* Cheek Riser */}
          <rect x="20" y="30" width="22" height="5" rx="1.5" fill={bodyDark} stroke={trimStroke} strokeWidth="1.4" />

          {/* Grip + Low-Profile Sniper Magazine */}
          <path d="M 52,45 L 63,45 L 57,66 L 46,65 Z" fill={bodyDark} strokeWidth="2" />
          <rect x="74" y="46" width="16" height="15" rx="1.5" fill={bodyPrimary} stroke={trimStroke} strokeWidth="1.6" />

          {/* Precision Rail Receiver */}
          <path
            d="M 50,31 L 124,31 L 128,35 L 128,46 L 50,46 Z"
            fill={`url(#metal_${uid})`}
            strokeWidth="2.2"
          />

          {/* Twin Magnetic Rail Barrels */}
          <rect x="124" y="31.5" width="76" height="5" rx="1" fill={bodySecondary} strokeWidth="1.8" />
          <rect x="124" y="39" width="72" height="4.8" rx="1" fill={bodyPrimary} strokeWidth="1.8" />
          {/* Glowing Plasma Rail Channel between barrels */}
          <line x1="126" y1="37.7" x2="196" y2="37.7" stroke={`url(#accent_${uid})`} strokeWidth="2.8" />

          {/* Muzzle Accelerator Brake */}
          <path
            d="M 196,30 L 211,32 L 211,43 L 196,45 Z"
            fill={bodyDark}
            stroke={trimStroke}
            strokeWidth="1.8"
          />

          {/* Magnified Long-Range Optical Scope */}
          <g>
            <line x1="72" y1="31" x2="72" y2="24" stroke={metalHighlight} strokeWidth="2.6" />
            <line x1="100" y1="31" x2="100" y2="24" stroke={metalHighlight} strokeWidth="2.6" />
            <path
              d="M 58,19 L 70,21 L 102,21 L 118,17 L 118,27 L 102,24 L 70,24 L 58,26 Z"
              fill={bodyDark}
              stroke={trimStroke}
              strokeWidth="1.8"
            />
            {/* Scope Lens Glint */}
            <ellipse cx="117" cy="22" rx="2" ry="4" fill={trimStroke} stroke="none" />
          </g>

          {/* Folding Front Bipod */}
          <path d="M 142,44 L 152,62 M 146,44 L 136,61" stroke={metalHighlight} strokeWidth="2.4" />

          {/* Lv 2+: Under-barrel Target Laser */}
          {upgradeLevel >= 2 && (
            <rect x="128" y="44" width="20" height="4.2" rx="1" fill={bodyDark} stroke={trimStroke} strokeWidth="1.3" />
          )}

          {/* Lv 3+: Capacitor Charge Rings along Rail */}
          {upgradeLevel >= 3 && (
            <g stroke={trimStroke} strokeWidth="2.2">
              <line x1="146" y1="30" x2="146" y2="45" />
              <line x1="166" y1="30" x2="166" y2="45" />
            </g>
          )}

          {/* Lv 4+: Overclocked Magnetic Coil Core */}
          {upgradeLevel >= 4 && (
            <g>
              <line x1="184" y1="30" x2="184" y2="45" stroke={trimStroke} strokeWidth="2.4" />
              <rect x="64" y="36" width="44" height="4.2" rx="1" fill={trimStroke} stroke="none" />
            </g>
          )}

          {/* Lv 5: Masterwork Gold Trim */}
          {isMasterwork && (
            <polygon points="54,33 116,33 112,35.8 54,35.8" fill="#FACC15" stroke="none" />
          )}
        </g>
      )}
    </svg>
  );
};

/** Crisp minted Gold Coin vector emblem used across HUD, Armory, Title, and Match Summary */
export const GoldCoinSvg: React.FC<{ size?: number; className?: string }> = ({
  size = 18,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={`shrink-0 select-none ${className}`}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10.5" fill="#D97706" stroke="#78350F" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="8.2" fill="#FACC15" stroke="#FEF08A" strokeWidth="1.1" />
    <polygon
      points="12,6.2 13.8,10.2 18,10.6 14.8,13.4 15.8,17.5 12,15.3 8.2,17.5 9.2,13.4 6,10.6 10.2,10.2"
      fill="#B45309"
    />
    <ellipse cx="9" cy="8.2" rx="2.6" ry="1.2" transform="rotate(-32 9 8.2)" fill="#FFFFFF" opacity="0.65" />
  </svg>
);
