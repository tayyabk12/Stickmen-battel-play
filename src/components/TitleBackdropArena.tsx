import React, { useEffect, useRef, useState } from 'react';
import { STICK_COLORS, type AccessoryType, type AnimState } from '../types/game';
import { StickFigureSvg } from './StickFigureSvg';

const CONCRETE_TEXTURE_URL = '/src/assets/images/arena_concrete_texture_1795067428629.jpg';

interface DemoRunner {
  id: number;
  x: number;
  y: number;
  angle: number;
  orbitR: number;
  speed: number;
  color: string;
  accessory: AccessoryType;
  phase: number;
  animState: AnimState;
}

/**
 * Live-world ambient arena preview rendered behind the Title Screen.
 * Showcases procedural joint-based stick figures sprinting, clashing, and orbiting a shrinking storm ring.
 */
export const TitleBackdropArena: React.FC = () => {
  const [, setTick] = useState(0);
  const runnersRef = useRef<DemoRunner[]>([
    { id: 1, x: -160, y: -60, angle: 0.2, orbitR: 210, speed: 0.72, color: STICK_COLORS[0].hex, accessory: 'crown', phase: 0, animState: 'run' },
    { id: 2, x: 180, y: 70, angle: 1.9, orbitR: 250, speed: -0.62, color: STICK_COLORS[1].hex, accessory: 'headband', phase: 2, animState: 'run' },
    { id: 3, x: -70, y: 170, angle: 3.4, orbitR: 165, speed: 0.84, color: STICK_COLORS[2].hex, accessory: 'shades', phase: 4, animState: 'walk' },
    { id: 4, x: 240, y: -130, angle: 4.8, orbitR: 280, speed: 0.54, color: STICK_COLORS[3].hex, accessory: 'horns', phase: 1, animState: 'run' },
    { id: 5, x: 20, y: -220, angle: 5.5, orbitR: 195, speed: -0.78, color: STICK_COLORS[4].hex, accessory: 'mohawk', phase: 3, animState: 'run' },
  ]);
  const timeRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      timeRef.current += dt;

      for (const r of runnersRef.current) {
        r.angle += r.speed * dt;
        const wobble = Math.sin(timeRef.current * 1.4 + r.id * 1.7) * 28;
        const rad = r.orbitR + wobble;
        const nx = Math.cos(r.angle) * rad;
        const ny = Math.sin(r.angle) * rad;
        r.x = nx;
        r.y = ny;
        r.phase += dt * 9.5;
        const pulseAttack = Math.sin(timeRef.current * 2.2 + r.id * 2.1) > 0.92;
        r.animState = pulseAttack ? 'attack' : 'run';
      }

      setTick((t) => (t + 1) & 0xffff);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const t = timeRef.current;
  const camX = Math.sin(t * 0.18) * 55;
  const camY = Math.cos(t * 0.14) * 35;
  const ringR = 335 + Math.sin(t * 0.35) * 38;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
      viewBox={`${-560 + camX} ${-340 + camY} 1120 680`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern id="title-concrete" width="280" height="280" patternUnits="userSpaceOnUse">
          <rect width="280" height="280" fill="#1B222D" />
          <image
            href={CONCRETE_TEXTURE_URL}
            width="280"
            height="280"
            preserveAspectRatio="xMidYMid slice"
            opacity="0.65"
          />
        </pattern>
        <mask id="title-storm-mask">
          <rect x="-1200" y="-1200" width="2400" height="2400" fill="#FFFFFF" />
          <circle cx="0" cy="0" r={ringR} fill="#000000" />
        </mask>
      </defs>

      <rect x="-1200" y="-1200" width="2400" height="2400" fill="url(#title-concrete)" />

      {/* Court lines */}
      <g stroke="#94A3B8" fill="none" opacity="0.16">
        <circle cx="0" cy="0" r="460" strokeWidth="2" strokeDasharray="10 10" />
        <circle cx="0" cy="0" r="240" strokeWidth="1.6" />
        <circle cx="0" cy="0" r="76" strokeWidth="2" />
        <line x1="-800" y1="0" x2="800" y2="0" strokeWidth="1.4" />
        <line x1="0" y1="-800" x2="0" y2="800" strokeWidth="1.4" />
      </g>

      {/* Architectural pillars */}
      {[
        { x: -120, y: -120 },
        { x: 120, y: -120 },
        { x: -120, y: 120 },
        { x: 120, y: 120 },
      ].map((p, idx) => (
        <g key={idx} transform={`translate(${p.x}, ${p.y})`}>
          <circle cx="5" cy="7" r="28" fill="#06090E" opacity="0.5" />
          <circle cx="0" cy="0" r="28" fill="#2A3340" stroke="#475569" strokeWidth="2.5" />
          <circle cx="0" cy="0" r="16" fill="#364152" />
        </g>
      ))}

      {/* Live AI Runners */}
      {runnersRef.current.map((r) => {
        const tangentAngle = r.angle + (r.speed >= 0 ? Math.PI / 2 : -Math.PI / 2);
        return (
          <StickFigureSvg
            key={r.id}
            x={r.x}
            y={r.y}
            color={r.color}
            accessory={r.accessory}
            animState={r.animState}
            animPhase={r.phase}
            facing={tangentAngle}
            health={100}
            shield={r.id === 1 ? 30 : 0}
            showHud={false}
            scale={1.15}
          />
        );
      })}

      {/* Storm tint outside shrinking ring */}
      <rect
        x="-1200"
        y="-1200"
        width="2400"
        height="2400"
        fill="rgba(220, 38, 38, 0.22)"
        mask="url(#title-storm-mask)"
      />
      <circle cx="0" cy="0" r={ringR} fill="none" stroke="#F97316" strokeWidth="4" opacity="0.88" />
    </svg>
  );
};
