import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Crosshair,
  LogIn,
  LogOut,
  Play,
  Plus,
  SlidersHorizontal,
  User as UserIcon,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  ACCESSORIES,
  GUN_UPGRADE_TIERS,
  MATCH_PRESETS,
  MAX_GUN_LEVEL,
  STICK_COLORS,
  type AccessoryType,
  type GameMode,
  type PlayerCustomization,
  type PlayerProgression,
  type UserProfile,
  type WeaponCategory,
} from '../types/game';
import { sanitizeRoomCode } from '../lib/firebase';
import { audioEngine } from '../lib/audio';
import { StickFigurePreview } from './StickFigureSvg';
import { TitleBackdropArena } from './TitleBackdropArena';
import { GoldCoinSvg } from './WeaponGraphicSvg';

interface TitleScreenProps {
  user: User | null;
  authLoading: boolean;
  profile: UserProfile | null;
  customization: PlayerCustomization;
  progression: PlayerProgression;
  armoryOpen?: boolean;
  selectedGameMode: GameMode;
  selectedRoundDurationSec: number;
  initialRoomCode: string;
  busyAction: string | null;
  errorMessage: string | null;
  onUpdateCustomization: (next: PlayerCustomization) => void;
  onOpenArmory: () => void;
  onChangeGameMode: (mode: GameMode) => void;
  onChangeRoundDurationSec: (sec: number) => void;
  onStartSolo: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onSignInGoogle: () => void;
  onSignInGuest: () => void;
  onSignOut: () => void;
  onClearError: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  user,
  authLoading,
  profile,
  customization,
  progression,
  armoryOpen = false,
  selectedGameMode,
  selectedRoundDurationSec,
  initialRoomCode,
  busyAction,
  errorMessage,
  onUpdateCustomization,
  onOpenArmory,
  onChangeGameMode,
  onChangeRoundDurationSec,
  onStartSolo,
  onCreateRoom,
  onJoinRoom,
  onSignInGoogle,
  onSignInGuest,
  onSignOut,
  onClearError,
}) => {
  const [roomCodeInput, setRoomCodeInput] = useState(initialRoomCode);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [muted, setMuted] = useState(() => audioEngine.isMuted());

  const upgradableCount = (['close', 'mid', 'long'] as WeaponCategory[]).filter((cat) => {
    const lv = progression.gunLevels[cat];
    if (lv >= MAX_GUN_LEVEL) return false;
    const next = GUN_UPGRADE_TIERS[lv];
    return progression.level >= next.requiredPlayerLevel && progression.coins >= next.cost;
  }).length;

  useEffect(() => {
    if (initialRoomCode) setRoomCodeInput(initialRoomCode);
  }, [initialRoomCode]);

  // Enter key launches Solo Arena immediately when no input or modal is focused
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || showCustomizer || armoryOpen) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        onStartSolo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStartSolo, showCustomizer, armoryOpen]);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeRoomCode(roomCodeInput);
    if (cleaned.length >= 4) {
      onJoinRoom(cleaned);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0E131A] text-slate-100">
      {/* Live-World Animated Arena Backdrop */}
      <TitleBackdropArena />

      {/* Measured Atmospheric Scrim preserving calm negative space on right */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(100deg, rgba(11,15,23,0.94) 0%, rgba(11,15,23,0.82) 44%, rgba(11,15,23,0.34) 76%, rgba(11,15,23,0.48) 100%)',
        }}
      />

      {/* Full-Viewport Game Shell Layout (scroll-safe on short phones & edge-to-edge on tablets/laptops) */}
      <div
        className="relative z-10 h-full w-full overflow-y-auto overscroll-contain"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col justify-between gap-6 p-4 sm:p-7 lg:p-10">
        {/* Top Utility Strip (Account + Audio — zero navbar bloat) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-400">
            <span className="font-bold text-sky-300 tabular-nums">Lv.{progression.level}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 font-mono font-bold text-amber-300 tabular-nums">
              <GoldCoinSvg size={15} />
              {progression.coins.toLocaleString()} Coins
            </span>
            {profile && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-200 font-semibold">{profile.displayName}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{profile.wins} Wins</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{profile.matchesPlayed} Matches</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {user && (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#141B26]/90 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            )}
            <button
              type="button"
              onClick={() => setMuted(audioEngine.toggleMute())}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/80 bg-[#141B26]/90 text-slate-200 transition-colors hover:bg-slate-800"
            >
              {muted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4 text-amber-400" />}
            </button>
          </div>
        </div>

        {/* Center Main Content: Left Title + Controls | Right Live Arena Breathing Room */}
        <div className="my-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-12">
          <div className="flex flex-col gap-5 lg:col-span-6 xl:col-span-5">
            {/* Bespoke Inline SVG Title Lockup */}
            <div>
              <svg
                viewBox="0 0 460 112"
                className="h-auto w-full max-w-[400px] overflow-visible"
                role="img"
                aria-label="LastOneStanding"
              >
                {/* Arena cross-ring emblem */}
                <g transform="translate(36, 54)">
                  <circle cx="0" cy="0" r="30" fill="none" stroke="#F97316" strokeWidth="3.5" />
                  <circle cx="0" cy="0" r="21" fill="none" stroke="#475569" strokeWidth="1.4" strokeDasharray="5 4" />
                  {/* Dynamic stick figure silhouette */}
                  <g stroke="#F8FAFC" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
                    <circle cx="3" cy="-12" r="5.5" fill="#F8FAFC" />
                    <line x1="2" y1="-6" x2="-2" y2="6" />
                    <line x1="1" y1="-2" x2="14" y2="-6" stroke="#F59E0B" />
                    <line x1="1" y1="-2" x2="-9" y2="3" />
                    <line x1="-2" y1="6" x2="9" y2="16" />
                    <line x1="-2" y1="6" x2="-11" y2="15" />
                  </g>
                </g>

                <text
                  x="82"
                  y="52"
                  fill="#F8FAFC"
                  fontFamily="Barlow Condensed, sans-serif"
                  fontWeight="800"
                  fontSize="52"
                  letterSpacing="2"
                >
                  LAST ONE
                </text>
                <text
                  x="82"
                  y="96"
                  fill="#F59E0B"
                  fontFamily="Barlow Condensed, sans-serif"
                  fontWeight="800"
                  fontSize="50"
                  letterSpacing="3"
                >
                  STANDING
                </text>
              </svg>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-300">
                Battle across 4 timed shrinking-zone rounds (3–5 min) with live per-avatar kills, points, and Rare Gold vault drops.
              </p>
            </div>

            {/* Active Fighter Summary + Customize Trigger */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-800/90 py-3">
              <div className="flex items-center gap-3.5">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-slate-700/80 bg-[#141B26]/90">
                  <StickFigurePreview
                    color={customization.color}
                    accessory={customization.accessory}
                    animState="walk"
                    size={52}
                  />
                </div>
                <div>
                  <div className="text-base font-bold text-slate-100">
                    {customization.displayName}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {STICK_COLORS.find((c) => c.hex === customization.color)?.name || 'Custom'}
                    <span className="mx-1.5">·</span>
                    {ACCESSORIES.find((a) => a.id === customization.accessory)?.label || 'None'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onOpenArmory}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    upgradableCount > 0
                      ? 'border-amber-400 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                      : 'border-slate-700 bg-[#17202E] text-slate-200 hover:border-amber-400/70 hover:text-amber-300'
                  }`}
                >
                  <Crosshair className="h-3.5 w-3.5 text-amber-400" />
                  <span>Gun Armory</span>
                  {upgradableCount > 0 && (
                    <span className="rounded bg-amber-400 px-1.5 py-0.2 font-mono text-[10px] font-extrabold text-slate-950 tabular-nums">
                      {upgradableCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomizer(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#17202E] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-amber-400/70 hover:text-amber-300 whitespace-nowrap shrink-0"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Customize
                </button>
              </div>
            </div>

            {/* Mode & 4-Round Pacing Selector */}
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-800 bg-[#121822]/90 p-1">
                <button
                  type="button"
                  onClick={() => onChangeGameMode('tdm')}
                  className={`rounded-md px-2 sm:px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                    selectedGameMode === 'tdm'
                      ? 'bg-slate-700/90 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="sm:hidden">TDM (4 Rds)</span>
                  <span className="hidden sm:inline">Team Deathmatch (4 Rds)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeGameMode('survival')}
                  className={`rounded-md px-2 sm:px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                    selectedGameMode === 'survival'
                      ? 'bg-slate-700/90 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="sm:hidden">Survival (4 Rds)</span>
                  <span className="hidden sm:inline">Survival Points (4 Rds)</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-slate-800 bg-[#121822]/90 p-1">
                {MATCH_PRESETS.map((preset) => (
                  <button
                    key={preset.roundSec}
                    type="button"
                    onClick={() => onChangeRoundDurationSec(preset.roundSec)}
                    className={`rounded-md py-1.5 text-[11px] font-semibold tabular-nums transition-colors whitespace-nowrap ${
                      selectedRoundDurationSec === preset.roundSec
                        ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Action: Instant Solo Skirmish */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onStartSolo}
                disabled={Boolean(busyAction)}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-amber-500 px-6 py-3.5 text-base font-bold text-slate-950 shadow-lg transition-colors hover:bg-amber-400 disabled:opacity-60 whitespace-nowrap"
              >
                <Play className="h-5 w-5 fill-current" />
                {selectedGameMode === 'tdm' ? 'Play 4-Round TDM (3v3)' : 'Play 4-Round Survival'}
              </button>

              {/* Multiplayer Private Room Section */}
              <div className="pt-1">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Private Room Multiplayer (2–8 Players)</span>
                  {user && (
                    <span className="text-emerald-400">
                      {user.isAnonymous ? 'Guest Connected' : 'Synced'}
                    </span>
                  )}
                </div>

                {authLoading ? (
                  <div className="py-3 text-xs text-slate-400">Checking Firebase session...</div>
                ) : !user ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={onSignInGoogle}
                      disabled={Boolean(busyAction)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-600 bg-[#182230] px-4 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:border-amber-400/70 hover:bg-[#1E2A3B] disabled:opacity-60 whitespace-nowrap"
                    >
                      <LogIn className="h-4 w-4 text-amber-400" />
                      {busyAction === 'google' ? 'Signing in...' : 'Sign in with Google'}
                    </button>
                    <button
                      type="button"
                      onClick={onSignInGuest}
                      disabled={Boolean(busyAction)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#131A24] px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      <UserIcon className="h-4 w-4" />
                      {busyAction === 'guest' ? 'Joining...' : 'Guest Sign-In'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <button
                      type="button"
                      onClick={onCreateRoom}
                      disabled={Boolean(busyAction)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/60 bg-[#1B2432] px-4 py-2.5 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/15 disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                      {busyAction === 'create' ? 'Creating...' : 'Create Room'}
                    </button>

                    <form onSubmit={handleJoinSubmit} className="flex flex-1 items-center gap-2">
                      <input
                        type="text"
                        value={roomCodeInput}
                        onChange={(e) => {
                          onClearError();
                          setRoomCodeInput(sanitizeRoomCode(e.target.value));
                        }}
                        placeholder="Room Code (e.g. K7X9P)"
                        maxLength={8}
                        className="w-full min-w-0 rounded-lg border border-slate-700 bg-[#111720] px-3.5 py-2.5 font-mono text-sm font-semibold uppercase tracking-widest text-slate-100 placeholder:font-sans placeholder:tracking-normal placeholder:normal-case placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={Boolean(busyAction) || roomCodeInput.trim().length < 4}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-white disabled:opacity-40 whitespace-nowrap shrink-0"
                      >
                        <span>{busyAction === 'join' ? '...' : 'Join'}</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                )}

                {errorMessage && (
                  <div className="mt-2.5 rounded-lg border border-red-500/40 bg-red-950/50 px-3.5 py-2.5 text-xs leading-relaxed text-red-200">
                    {errorMessage}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side intentionally left open so the live animated arena shines */}
          <div className="hidden lg:block lg:col-span-6 xl:col-span-7" />
        </div>

        {/* Single Flat Control-Hint Line */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-400">
          <div className="hidden md:block">
            WASD Move · Shift Dash · C Cover · Space / Click Fire · Q Shroud · E Swap · R Nova
          </div>
          <div className="md:hidden">
            Touch Joystick + Fire / Dash / Cover / Nova Pad auto-enabled on mobile &amp; tablets
          </div>
          <div className="text-slate-500">
            Collect Gold Coins · Level Up · Upgrade Graphic Guns MK-I to MK-V
          </div>
        </div>
        </div>
      </div>

      {/* Avatar Customizer Modal */}
      {showCustomizer && (
        <div className="absolute inset-0 z-30 flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain bg-[#090D14]/82 p-4">
          <div className="my-auto w-full max-w-md rounded-xl border border-slate-700 bg-[#151C27] p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold tracking-wide text-slate-50">
                Customize Fighter
              </h2>
              <button
                type="button"
                onClick={() => setShowCustomizer(false)}
                aria-label="Close customizer"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center rounded-lg border border-slate-800 bg-[#10161F] py-5">
              <StickFigurePreview
                color={customization.color}
                accessory={customization.accessory}
                animState="run"
                size={96}
              />
              <span className="mt-1 text-sm font-bold text-slate-100">
                {customization.displayName}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {/* Nickname */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Fighter Name
                </label>
                <input
                  type="text"
                  maxLength={20}
                  value={customization.displayName}
                  onChange={(e) =>
                    onUpdateCustomization({
                      ...customization,
                      displayName: e.target.value.slice(0, 20),
                    })
                  }
                  placeholder="Enter nickname"
                  className="w-full rounded-lg border border-slate-700 bg-[#10161F] px-3.5 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* Color Swatches */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Ink Color
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {STICK_COLORS.map((c) => {
                    const active = customization.color === c.hex;
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => onUpdateCustomization({ ...customization, color: c.hex })}
                        title={c.name}
                        aria-label={c.name}
                        className={`h-9 w-full rounded-md transition-transform ${
                          active ? 'scale-105 ring-2 ring-white ring-offset-2 ring-offset-[#151C27]' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Accessories */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Accessory
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {ACCESSORIES.map((acc) => {
                    const active = customization.accessory === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() =>
                          onUpdateCustomization({
                            ...customization,
                            accessory: acc.id as AccessoryType,
                          })
                        }
                        className={`rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                          active
                            ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                            : 'border-slate-700 bg-[#10161F] text-slate-300 hover:border-slate-500 hover:text-white'
                        }`}
                      >
                        {acc.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCustomizer(false)}
              className="mt-6 w-full rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400"
            >
              Save Fighter
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
