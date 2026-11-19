import React, { useEffect, useRef, useState } from 'react';
import {
  CloudFog,
  Crosshair,
  Repeat2,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { RARITY_META, WEAPON_CATALOG, type LootRarity, type WeaponCategory } from '../types/game';

export interface MobileSwapPrompt {
  label: string;
  rarity: LootRarity;
  role: string;
}

interface MobileControllerProps {
  weaponCategory: WeaponCategory;
  weaponName: string;
  weaponRarity: LootRarity;
  weaponInventory: Record<WeaponCategory, LootRarity>;
  weaponReadyPct: number;
  hasTargetInRange: boolean;
  dashReadyPct: number;
  inCover: boolean;
  canSnapCover: boolean;
  utilityCharges: number;
  utilityReadyPct: number;
  overdrivePct: number;
  swapPrompt: MobileSwapPrompt | null;
  autoFire: boolean;
  viewportW: number;
  viewportH: number;
  onToggleAutoFire: () => void;
  onCycleWeapon: () => void;
  onMoveVector: (x: number, y: number) => void;
  onFireChange: (firing: boolean) => void;
  onDash: () => void;
  onCover: () => void;
  onUtility: () => void;
  onNova: () => void;
  onSwap: () => void;
}

const triggerHaptic = (ms: number) => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(ms);
    } catch {
      // Ignore unsupported environments
    }
  }
};

interface RadialRingProps {
  size: number;
  strokeWidth: number;
  progress: number;
  color: string;
  trackColor?: string;
}

const RadialRing: React.FC<RadialRingProps> = ({
  size,
  strokeWidth,
  progress,
  color,
  trackColor = 'rgba(148, 163, 184, 0.16)',
}) => {
  const clamped = Math.max(0, Math.min(1, progress));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - clamped);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none absolute inset-0 -rotate-90"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={c}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
      />
    </svg>
  );
};

export const MobileController: React.FC<MobileControllerProps> = ({
  weaponCategory,
  weaponName,
  weaponRarity,
  weaponInventory,
  weaponReadyPct,
  hasTargetInRange,
  dashReadyPct,
  inCover,
  canSnapCover,
  utilityCharges,
  utilityReadyPct,
  overdrivePct,
  swapPrompt,
  autoFire,
  viewportW,
  viewportH,
  onToggleAutoFire,
  onCycleWeapon,
  onMoveVector,
  onFireChange,
  onDash,
  onCover,
  onUtility,
  onNova,
  onSwap,
}) => {
  // Multi-touch isolated joystick tracking
  const joyPointerIdRef = useRef<number | null>(null);
  const joyOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [joyState, setJoyState] = useState<{
    active: boolean;
    x: number;
    y: number;
    mag: number;
    angleDeg: number;
  }>({ active: false, x: 0, y: 0, mag: 0, angleDeg: 0 });

  // Multi-touch isolated fire button tracking
  const firePointerIdRef = useRef<number | null>(null);
  const [fireHeld, setFireHeld] = useState(false);

  // Stable callback refs so unmount cleanup only runs when MobileController truly unmounts
  const onMoveVectorRef = useRef(onMoveVector);
  const onFireChangeRef = useRef(onFireChange);
  onMoveVectorRef.current = onMoveVector;
  onFireChangeRef.current = onFireChange;

  // Release joystick & fire cleanly on unmount (e.g., round end, pause, downed)
  useEffect(() => {
    return () => {
      onMoveVectorRef.current(0, 0);
      onFireChangeRef.current(false);
    };
  }, []);

  const MAX_JOY_RADIUS = 44;

  const updateJoystick = (clientX: number, clientY: number) => {
    const origin = joyOriginRef.current;
    if (!origin) return;
    const dx = clientX - origin.x;
    const dy = clientY - origin.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, MAX_JOY_RADIUS);
    const mag = clamped / MAX_JOY_RADIUS;
    const nx = dist > 0.01 ? (dx / dist) * mag : 0;
    const ny = dist > 0.01 ? (dy / dist) * mag : 0;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    onMoveVector(nx, ny);
    setJoyState({
      active: true,
      x: nx * MAX_JOY_RADIUS,
      y: ny * MAX_JOY_RADIUS,
      mag,
      angleDeg,
    });
  };

  const handleJoyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (joyPointerIdRef.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerIdRef.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    joyOriginRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoyPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateJoystick(e.clientX, e.clientY);
  };

  const handleJoyPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    joyPointerIdRef.current = null;
    joyOriginRef.current = null;
    onMoveVector(0, 0);
    setJoyState({ active: false, x: 0, y: 0, mag: 0, angleDeg: 0 });
  };

  const handleFirePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (firePointerIdRef.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    firePointerIdRef.current = e.pointerId;
    setFireHeld(true);
    onFireChange(true);
    triggerHaptic(12);
  };

  const handleFirePointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (firePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    firePointerIdRef.current = null;
    setFireHeld(false);
    onFireChange(false);
  };

  const rarityMeta = RARITY_META[weaponRarity];
  const novaReady = overdrivePct >= 100;
  const dashReady = dashReadyPct >= 0.99;
  const shroudReady = utilityCharges > 0 && utilityReadyPct >= 0.99;

  // Auto-scale touch gamepad cleanly across portrait phone, short landscape phone, tablet, and desktop frames
  const padScale =
    viewportH < 440
      ? 0.78
      : viewportW < 395
        ? 0.82
        : viewportW < 640 || viewportH < 560
          ? 0.9
          : 1;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-15 flex items-end justify-between select-none"
      style={{
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* LEFT THUMB ZONE: Smart Auto-Fire Toggle + 360° Precision Analog Stick */}
      <div
        className="pointer-events-none flex origin-bottom-left flex-col items-start gap-2.5"
        style={{ transform: `scale(${padScale})` }}
      >
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            triggerHaptic(8);
            onToggleAutoFire();
          }}
          className={`pointer-events-auto touch-none inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-extrabold uppercase tracking-wider shadow-lg transition-colors active:scale-95 whitespace-nowrap ${
            autoFire
              ? 'border-amber-400/90 bg-amber-500/25 text-amber-200'
              : 'border-slate-600/80 bg-[#101722]/85 text-slate-300'
          }`}
          aria-pressed={autoFire}
          aria-label="Toggle smart auto-fire when enemy is in range"
        >
          <Crosshair className={`h-3.5 w-3.5 ${autoFire ? 'text-amber-300' : 'text-slate-400'}`} />
          <span>Auto-Shoot {autoFire ? 'ON' : 'OFF'}</span>
        </button>

        {/* Analog Stick Pad */}
        <div
          onPointerDown={handleJoyPointerDown}
          onPointerMove={handleJoyPointerMove}
          onPointerUp={handleJoyPointerEnd}
          onPointerCancel={handleJoyPointerEnd}
          role="slider"
          aria-label="Move character joystick"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(joyState.mag * 100)}
          className={`pointer-events-auto touch-none relative flex h-[136px] w-[136px] items-center justify-center rounded-full border-2 backdrop-blur-[2px] transition-colors ${
            joyState.active
              ? joyState.mag > 0.82
                ? 'border-amber-400/90 bg-[#0F1622]/82 shadow-[0_0_24px_rgba(245,158,11,0.22)]'
                : 'border-slate-400/80 bg-[#0F1622]/80'
              : 'border-slate-600/75 bg-[#0F1622]/65'
          }`}
        >
          {/* Gimbal Crosshair & Directional Ticks */}
          <svg
            width="136"
            height="136"
            viewBox="0 0 136 136"
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
          >
            <circle
              cx="68"
              cy="68"
              r="46"
              fill="none"
              stroke="rgba(148, 163, 184, 0.2)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            {/* Cardinal Ticks */}
            <line x1="68" y1="9" x2="68" y2="18" stroke="rgba(203, 213, 225, 0.45)" strokeWidth="2" strokeLinecap="round" />
            <line x1="68" y1="118" x2="68" y2="127" stroke="rgba(203, 213, 225, 0.45)" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="68" x2="18" y2="68" stroke="rgba(203, 213, 225, 0.45)" strokeWidth="2" strokeLinecap="round" />
            <line x1="118" y1="68" x2="127" y2="68" stroke="rgba(203, 213, 225, 0.45)" strokeWidth="2" strokeLinecap="round" />

            {/* Live Directional Glow Arc */}
            {joyState.active && joyState.mag > 0.14 && (
              <g transform={`rotate(${joyState.angleDeg} 68 68)`}>
                <path
                  d="M 118 44 A 56 56 0 0 1 118 92"
                  fill="none"
                  stroke={joyState.mag > 0.82 ? '#F59E0B' : '#38BDF8'}
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity="0.92"
                />
              </g>
            )}
          </svg>

          {/* Center label when idle */}
          {!joyState.active && (
            <span className="pointer-events-none text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
              MOVE
            </span>
          )}

          {/* Tactile Thumb Knob */}
          <div
            className={`pointer-events-none flex h-[54px] w-[54px] items-center justify-center rounded-full border-2 shadow-xl will-change-transform ${
              joyState.active
                ? 'border-amber-200 bg-gradient-to-b from-amber-400 to-amber-600 shadow-amber-500/35'
                : 'border-slate-400/80 bg-gradient-to-b from-slate-600/90 to-slate-800/95'
            }`}
            style={{
              transform: `translate3d(${joyState.x}px, ${joyState.y}px, 0)`,
            }}
          >
            <div
              className={`h-6 w-6 rounded-full border ${
                joyState.active
                  ? 'border-amber-100/70 bg-amber-300/40'
                  : 'border-slate-400/40 bg-slate-500/30'
              }`}
            />
          </div>
        </div>
      </div>

      {/* RIGHT THUMB ZONE: Curved Ergonomic Shooter Action Cluster */}
      <div
        className="pointer-events-none relative h-[206px] w-[224px] shrink-0 origin-bottom-right"
        style={{ transform: `scale(${padScale})` }}
      >
        {/* CONTEXTUAL FLOOR SWAP BUTTON (far-left upper when standing near a swappable weapon) */}
        {swapPrompt && (
          <div className="pointer-events-none absolute bottom-[78px] left-[-10px] flex flex-col items-center gap-1">
            <span
              className="max-w-[92px] truncate rounded bg-[#0C121B]/95 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide shadow"
              style={{ color: RARITY_META[swapPrompt.rarity].color }}
            >
              {swapPrompt.label}
            </span>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                triggerHaptic(14);
                onSwap();
              }}
              aria-label={`Pick up ${swapPrompt.label}`}
              className="pointer-events-auto touch-none flex h-[54px] w-[54px] flex-col items-center justify-center rounded-full border-2 bg-[#101824]/92 shadow-lg transition-transform active:scale-92"
              style={{
                borderColor: RARITY_META[swapPrompt.rarity].border,
                color: RARITY_META[swapPrompt.rarity].color,
              }}
            >
              <Repeat2 className="h-4 w-4" />
              <span className="mt-0.5 text-[9px] font-extrabold uppercase leading-none">Grab</span>
            </button>
          </div>
        )}

        {/* INSTANT MID-FIGHT WEAPON SWITCH BUTTON (bottom-left of cluster — 1 tap cycles Shotgun / SMG / Sniper) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            triggerHaptic(10);
            onCycleWeapon();
          }}
          aria-label={`Switch weapon (current: ${weaponName})`}
          className="pointer-events-auto touch-none absolute bottom-[6px] left-[-10px] flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full border-2 bg-[#101824]/92 shadow-lg transition-transform active:scale-92"
          style={{
            borderColor: rarityMeta.border,
            color: rarityMeta.color,
          }}
        >
          <Repeat2 className="h-3.5 w-3.5" />
          <span className="mt-0.5 text-[9px] font-black uppercase tracking-tight leading-none">
            {WEAPON_CATALOG[weaponCategory].shortTag}
          </span>
          <div className="mt-1 flex items-center gap-1">
            {(['close', 'mid', 'long'] as WeaponCategory[]).map((cat) => {
              const active = cat === weaponCategory;
              const slotColor = RARITY_META[weaponInventory[cat]].color;
              return (
                <span
                  key={cat}
                  className="rounded-full transition-all"
                  style={{
                    width: active ? '9px' : '5px',
                    height: '5px',
                    backgroundColor: slotColor,
                    opacity: active ? 1 : 0.48,
                  }}
                />
              );
            })}
          </div>
        </button>

        {/* NOVA ULTIMATE BUTTON (11 o'clock upper arc) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            if (novaReady) {
              triggerHaptic(24);
              onNova();
            }
          }}
          aria-label={novaReady ? 'Unleash Overdrive Nova' : `Nova charging ${overdrivePct}%`}
          className={`pointer-events-auto touch-none absolute top-[6px] left-[62px] flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full border-2 transition-transform active:scale-92 ${
            novaReady
              ? 'border-cyan-200 bg-cyan-400 text-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.55)]'
              : 'border-slate-700/80 bg-[#101722]/85 text-slate-300'
          }`}
        >
          <RadialRing
            size={58}
            strokeWidth={3.5}
            progress={overdrivePct / 100}
            color={novaReady ? '#ECFEFF' : '#22D3EE'}
          />
          <Sparkles className={`h-4 w-4 ${novaReady ? 'text-slate-950' : 'text-cyan-400'}`} />
          <span className="mt-0.5 font-mono text-[10px] font-extrabold uppercase leading-none tabular-nums">
            {novaReady ? 'NOVA' : `${overdrivePct}%`}
          </span>
        </button>

        {/* SHROUD UTILITY BUTTON (12 o'clock, directly above FIRE) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            if (utilityCharges > 0) {
              triggerHaptic(14);
              onUtility();
            }
          }}
          disabled={utilityCharges <= 0}
          aria-label={`Deploy Shroud Snare (${utilityCharges} charges)`}
          className={`pointer-events-auto touch-none absolute top-[2px] right-[12px] flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full border-2 transition-transform active:scale-92 disabled:opacity-45 ${
            shroudReady
              ? 'border-purple-400/90 bg-purple-950/90 text-purple-100 shadow-lg'
              : 'border-slate-700/80 bg-[#101722]/82 text-slate-400'
          }`}
        >
          <RadialRing
            size={58}
            strokeWidth={3.5}
            progress={utilityCharges > 0 ? utilityReadyPct : 0}
            color="#C084FC"
          />
          <CloudFog className="h-4 w-4 text-purple-300" />
          <span className="mt-0.5 text-[10px] font-extrabold uppercase leading-none tabular-nums">
            {utilityCharges > 0 ? `x${utilityCharges}` : 'Smoke'}
          </span>
        </button>

        {/* COVER SNAP BUTTON (9:30 position, left-upper of FIRE) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            triggerHaptic(12);
            onCover();
          }}
          aria-label="Take cover behind nearest block"
          className={`pointer-events-auto touch-none absolute top-[72px] left-[46px] flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full border-2 shadow-lg transition-transform active:scale-92 ${
            inCover
              ? 'border-emerald-200 bg-emerald-500 text-slate-950 shadow-[0_0_18px_rgba(16,185,129,0.45)]'
              : canSnapCover
                ? 'border-emerald-400 bg-emerald-950/92 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.3)]'
                : 'border-slate-600/80 bg-[#101722]/82 text-slate-300'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span className="mt-0.5 text-[10px] font-extrabold uppercase leading-none">
            {inCover ? 'Safe' : 'Cover'}
          </span>
        </button>

        {/* DASH / DODGE BUTTON (7:30 position, bottom-left of FIRE) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            if (dashReady) {
              triggerHaptic(14);
            }
            onDash();
          }}
          aria-label="Dash dodge"
          className={`pointer-events-auto touch-none absolute bottom-[6px] left-[54px] flex h-[60px] w-[60px] flex-col items-center justify-center rounded-full border-2 shadow-lg transition-transform active:scale-92 ${
            dashReady
              ? 'border-amber-400/80 bg-[#162030]/92 text-slate-100'
              : 'border-slate-700/80 bg-[#0F1622]/80 text-slate-400'
          }`}
        >
          <RadialRing
            size={60}
            strokeWidth={3.5}
            progress={dashReadyPct}
            color="#F59E0B"
          />
          <Zap className={`h-4 w-4 ${dashReady ? 'text-amber-400' : 'text-slate-500'}`} />
          <span className="mt-0.5 text-[10px] font-extrabold uppercase leading-none">Dash</span>
        </button>

        {/* PRIMARY SHOOT / FIRE BUTTON (Large 86×86px bottom-right anchor — Tap OR Hold to auto-fire) */}
        <button
          type="button"
          onPointerDown={handleFirePointerDown}
          onPointerUp={handleFirePointerEnd}
          onPointerCancel={handleFirePointerEnd}
          onLostPointerCapture={handleFirePointerEnd}
          aria-label={`Fire ${weaponName} (hold for continuous fire)`}
          className={`pointer-events-auto touch-none absolute right-[2px] bottom-[2px] flex h-[86px] w-[86px] flex-col items-center justify-center rounded-full border-2 shadow-2xl transition-transform ${
            fireHeld ? 'scale-92' : 'scale-100'
          } ${
            hasTargetInRange || fireHeld
              ? 'border-amber-200 bg-gradient-to-b from-amber-400 to-orange-600 text-slate-950 shadow-[0_0_26px_rgba(245,158,11,0.5)]'
              : 'border-slate-400/80 bg-gradient-to-b from-[#1E293B]/95 to-[#0F172A]/95 text-slate-100'
          }`}
        >
          <RadialRing
            size={86}
            strokeWidth={4}
            progress={weaponReadyPct}
            color={hasTargetInRange || fireHeld ? '#FEF3C7' : rarityMeta.color}
            trackColor="rgba(15, 23, 42, 0.35)"
          />
          <Crosshair className="h-7 w-7 stroke-[2.4]" />
          <span className="mt-0.5 text-[11px] font-black uppercase tracking-wider leading-none">
            {fireHeld ? 'FIRING' : 'FIRE'}
          </span>
        </button>
      </div>
    </div>
  );
};
