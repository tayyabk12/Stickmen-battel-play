import React, { useState } from 'react';
import {
  Check,
  Music2,
  Play,
  Shuffle,
  SlidersHorizontal,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { audioEngine, KILL_SOUND_OPTIONS, type KillSoundChoice } from '../lib/audio';

interface SoundSettingsModalProps {
  onClose: () => void;
  onMuteChanged?: (muted: boolean) => void;
}

export const SoundSettingsModal: React.FC<SoundSettingsModalProps> = ({
  onClose,
  onMuteChanged,
}) => {
  const [muted, setMuted] = useState(() => audioEngine.isMuted());
  const [killSound, setKillSound] = useState<KillSoundChoice>(() => audioEngine.getKillSound());
  const [masterVol, setMasterVol] = useState(() => Math.round(audioEngine.getMasterVolume() * 100));
  const [voiceVol, setVoiceVol] = useState(() => Math.round(audioEngine.getVoiceVolume() * 100));
  const [sfxVol, setSfxVol] = useState(() => Math.round(audioEngine.getSfxVolume() * 100));

  const handleToggleMute = () => {
    const next = audioEngine.toggleMute();
    setMuted(next);
    onMuteChanged?.(next);
  };

  const handleMasterChange = (val: number) => {
    setMasterVol(val);
    audioEngine.setMasterVolume(val / 100);
    const nowMuted = audioEngine.isMuted();
    if (nowMuted !== muted) {
      setMuted(nowMuted);
      onMuteChanged?.(nowMuted);
    }
  };

  const handleVoiceChange = (val: number) => {
    setVoiceVol(val);
    audioEngine.setVoiceVolume(val / 100);
  };

  const handleSfxChange = (val: number) => {
    setSfxVol(val);
    audioEngine.setSfxVolume(val / 100);
  };

  const handleSelectKillSound = (choice: KillSoundChoice) => {
    setKillSound(choice);
    audioEngine.setKillSound(choice);
    if (choice === 'faaah' || choice === 'haath_be') {
      audioEngine.previewKillSound(choice);
      if (muted) {
        setMuted(false);
        onMuteChanged?.(false);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain bg-[#090D14]/84 p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          audioEngine.stopCustomClips();
          onClose();
        }
      }}
    >
      <div className="my-auto w-full max-w-md rounded-xl border border-slate-700 bg-[#151C27] p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-extrabold leading-none tracking-wide text-slate-50">
                Sound Settings
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Choose your enemy-kill sound &amp; tune audio volume
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMute}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors ${
                muted
                  ? 'border-red-500/60 bg-red-500/15 text-red-300'
                  : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
              }`}
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              <span>{muted ? 'Muted' : 'On'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                audioEngine.stopCustomClips();
                onClose();
              }}
              aria-label="Close sound settings"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Enemy Kill Sound Selector */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
              Enemy Kill Sound (When You KO an Enemy)
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {KILL_SOUND_OPTIONS.map((opt) => {
              const selected = killSound === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelectKillSound(opt.id)}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectKillSound(opt.id);
                    }
                  }}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-all ${
                    selected
                      ? 'border-amber-400/90 bg-amber-500/15 shadow-sm'
                      : 'border-slate-700/80 bg-[#10161F] hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? 'border-amber-300 bg-amber-400 text-slate-950'
                          : 'border-slate-600 bg-slate-900 text-slate-500'
                      }`}
                    >
                      {opt.id === 'random' && !selected ? (
                        <Shuffle className="h-3 w-3" />
                      ) : selected ? (
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-100">{opt.label}</div>
                      <div className="truncate text-[11px] text-slate-400">{opt.subtitle}</div>
                    </div>
                  </div>

                  {(opt.id === 'faaah' || opt.id === 'haath_be') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        audioEngine.previewKillSound(opt.id as 'faaah' | 'haath_be');
                        if (muted) {
                          setMuted(false);
                          onMuteChanged?.(false);
                        }
                      }}
                      aria-label={`Preview ${opt.label}`}
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-slate-600/90 bg-slate-800/90 px-2.5 text-[11px] font-bold text-slate-200 transition-colors hover:border-amber-400/70 hover:text-amber-300"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>Test</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Volume Sliders */}
        <div className="mt-5 space-y-3.5 rounded-lg border border-slate-800 bg-[#10161F] p-3.5">
          <div className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
            Volume Controls
          </div>

          {/* Master Volume */}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Master Volume</span>
              <span className="font-mono font-bold text-amber-300 tabular-nums">{masterVol}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={masterVol}
              onChange={(e) => handleMasterChange(Number(e.target.value))}
              aria-label="Master Volume"
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-amber-400"
            />
          </div>

          {/* Custom Voice & Music Clips Volume */}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Kill Sounds &amp; Music Clips</span>
              <span className="font-mono font-bold text-sky-300 tabular-nums">{voiceVol}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={voiceVol}
              onChange={(e) => handleVoiceChange(Number(e.target.value))}
              aria-label="Kill Sounds and Music Clips Volume"
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-sky-400"
            />
          </div>

          {/* Weapons & Game SFX Volume */}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Weapons &amp; Combat SFX</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => audioEngine.playWeaponFire('close', true)}
                  className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300 hover:border-amber-400/70 hover:text-amber-300"
                >
                  Test SFX
                </button>
                <span className="font-mono font-bold text-emerald-300 tabular-nums">{sfxVol}%</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={sfxVol}
              onChange={(e) => handleSfxChange(Number(e.target.value))}
              aria-label="Weapons and Combat SFX Volume"
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-emerald-400"
            />
          </div>
        </div>

        {/* Quick Clip Soundcheck Strip */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/90 bg-[#0F151E] px-3 py-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-400">
            <Music2 className="h-3.5 w-3.5 text-amber-400" />
            Quick Test:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => audioEngine.playGameStartMusic()}
              className="rounded border border-slate-700 bg-slate-800/80 px-2 py-1 font-bold text-slate-200 hover:border-amber-400/70 hover:text-amber-300"
            >
              Start
            </button>
            <button
              type="button"
              onClick={() => audioEngine.playEnemyKilledUser()}
              className="rounded border border-slate-700 bg-slate-800/80 px-2 py-1 font-bold text-slate-200 hover:border-amber-400/70 hover:text-amber-300"
            >
              KO&apos;d
            </button>
            <button
              type="button"
              onClick={() => audioEngine.playVictorySong()}
              className="rounded border border-slate-700 bg-slate-800/80 px-2 py-1 font-bold text-slate-200 hover:border-amber-400/70 hover:text-amber-300"
            >
              Win
            </button>
            <button
              type="button"
              onClick={() => audioEngine.stopCustomClips()}
              title="Stop preview audio"
              className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-bold text-slate-400 hover:text-red-300"
            >
              <Square className="h-2.5 w-2.5 fill-current" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              audioEngine.stopCustomClips();
              onClose();
            }}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-extrabold text-slate-950 transition-colors hover:bg-amber-400"
          >
            Save &amp; Done
          </button>
        </div>
      </div>
    </div>
  );
};
