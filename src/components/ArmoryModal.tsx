import React, { useState } from 'react';
import { ArrowUpCircle, CheckCircle2, Lock, Sparkles, X, Zap } from 'lucide-react';
import {
  getGunUpgradeTier,
  getWeaponSpec,
  getXpForNextLevel,
  GUN_UPGRADE_TIERS,
  MAX_GUN_LEVEL,
  MAX_PLAYER_LEVEL,
  WEAPON_CATALOG,
  type PlayerProgression,
  type WeaponCategory,
} from '../types/game';
import { audioEngine } from '../lib/audio';
import { GoldCoinSvg, WeaponGraphicSvg } from './WeaponGraphicSvg';

interface ArmoryModalProps {
  progression: PlayerProgression;
  onUpgradeGun: (category: WeaponCategory) => boolean;
  onClose: () => void;
}

const WEAPON_ORDER: WeaponCategory[] = ['close', 'mid', 'long'];

export const ArmoryModal: React.FC<ArmoryModalProps> = ({
  progression,
  onUpgradeGun,
  onClose,
}) => {
  const [justUpgraded, setJustUpgraded] = useState<WeaponCategory | null>(null);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const nextLevelXp = getXpForNextLevel(progression.level);
  const xpPct =
    progression.level >= MAX_PLAYER_LEVEL
      ? 100
      : Math.min(100, Math.round((progression.xp / Math.max(1, nextLevelXp)) * 100));

  const handleUpgrade = (category: WeaponCategory) => {
    const ok = onUpgradeGun(category);
    if (ok) {
      audioEngine.playGunUpgrade();
      setJustUpgraded(category);
      window.setTimeout(() => {
        setJustUpgraded((prev) => (prev === category ? null : prev));
      }, 900);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#090D14]/88 p-4">
      <div className="my-auto w-full max-w-5xl rounded-xl border border-slate-700 bg-[#141B26] p-5 shadow-2xl sm:p-6">
        {/* Header Bar: Title + Player Level XP + Gold Coins */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-wide text-slate-50">
              Gun Armory & Power Upgrades
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Spend Gold Coins collected in the arena to permanently boost each firearm&apos;s damage, range, and fire rate.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Level + XP Progress Box */}
            <div className="min-w-[155px] rounded-lg border border-slate-700/80 bg-[#0F151E] px-3 py-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="inline-flex items-center gap-1 text-sky-300">
                  <Zap className="h-3.5 w-3.5" />
                  Level {progression.level}
                </span>
                <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                  {progression.level >= MAX_PLAYER_LEVEL
                    ? 'MAX'
                    : `${progression.xp}/${nextLevelXp} XP`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-sky-400 transition-all duration-300"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            </div>

            {/* Gold Coin Balance */}
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/45 bg-amber-950/30 px-3.5 py-2">
              <GoldCoinSvg size={22} />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
                  Coins
                </div>
                <div className="font-mono text-base font-extrabold leading-none text-amber-300 tabular-nums">
                  {progression.coins.toLocaleString()}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Armory"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/80 bg-[#10161F] text-slate-400 transition-colors hover:bg-slate-800 hover:text-white shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 3 Graphic Firearm Upgrade Cards */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {WEAPON_ORDER.map((category) => {
            const meta = WEAPON_CATALOG[category];
            const currentLevel = progression.gunLevels[category];
            const isMax = currentLevel >= MAX_GUN_LEVEL;
            const currentTier = getGunUpgradeTier(currentLevel);
            const nextTier = !isMax ? GUN_UPGRADE_TIERS[currentLevel] : null;

            const currentCommon = getWeaponSpec(category, 'common', currentLevel);
            const currentRare = getWeaponSpec(category, 'rare', currentLevel);
            const nextRare = nextTier ? getWeaponSpec(category, 'rare', nextTier.level) : null;
            const nextCommon = nextTier ? getWeaponSpec(category, 'common', nextTier.level) : null;

            const levelMet = !nextTier || progression.level >= nextTier.requiredPlayerLevel;
            const canAfford = !nextTier || progression.coins >= nextTier.cost;
            const canUpgrade = !isMax && levelMet && canAfford;
            const flashing = justUpgraded === category;

            // Normalize stat bars cleanly across all 3 gun roles
            const dmgPct = Math.min(100, Math.round((currentRare.damage / 52) * 100));
            const nextDmgPct = nextRare
              ? Math.min(100, Math.round((nextRare.damage / 52) * 100))
              : dmgPct;

            const rngPct = Math.min(100, Math.round((currentRare.range / 500) * 100));
            const nextRngPct = nextRare
              ? Math.min(100, Math.round((nextRare.range / 500) * 100))
              : rngPct;

            const currentRof = +(1 / currentCommon.cooldownSec).toFixed(2);
            const nextRof = nextCommon ? +(1 / nextCommon.cooldownSec).toFixed(2) : currentRof;
            const rofPct = Math.min(100, Math.round((currentRof / 3.0) * 100));
            const nextRofPct = Math.min(100, Math.round((nextRof / 3.0) * 100));

            return (
              <div
                key={category}
                className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                  flashing
                    ? 'border-amber-400 bg-amber-950/25 shadow-lg shadow-amber-500/15'
                    : 'border-slate-700/80 bg-[#10161F]'
                }`}
              >
                <div>
                  {/* Weapon Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {meta.roleLabel}
                      </div>
                      <h3 className="font-display text-2xl font-extrabold tracking-wide text-slate-50">
                        {meta.name}
                      </h3>
                    </div>
                    <div
                      className="rounded-md border px-2 py-0.5 font-mono text-xs font-extrabold tabular-nums shrink-0"
                      style={{
                        borderColor: `${currentTier.accent}88`,
                        color: currentTier.accent,
                        backgroundColor: `${currentTier.accent}18`,
                      }}
                    >
                      {currentTier.code} · Lv.{currentLevel}
                    </div>
                  </div>

                  {/* Graphic Gun Blueprint Display */}
                  <div
                    className="relative mt-3 flex h-32 items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-[#0B1018] px-3"
                    style={{
                      backgroundImage:
                        'radial-gradient(rgba(148,163,184,0.14) 1px, transparent 1px)',
                      backgroundSize: '14px 14px',
                    }}
                  >
                    <WeaponGraphicSvg
                      category={category}
                      upgradeLevel={currentLevel}
                      className="h-24 w-full max-w-[230px]"
                    />
                    {flashing && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-amber-400/15">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-extrabold text-slate-950 shadow">
                          <Sparkles className="h-3.5 w-3.5" />
                          POWER UPGRADED!
                        </span>
                      </div>
                    )}
                    {/* Tier progress pips */}
                    <div className="absolute bottom-2 right-2.5 flex items-center gap-1">
                      {GUN_UPGRADE_TIERS.map((t) => (
                        <span
                          key={t.level}
                          className="h-1.5 w-4 rounded-xs transition-colors"
                          style={{
                            backgroundColor:
                              t.level <= currentLevel ? currentTier.accent : '#1E293B',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs leading-relaxed text-slate-400">
                    {meta.description}
                  </p>

                  {/* Live Stat Bars with Upgrade Preview */}
                  <div className="mt-3.5 space-y-2.5 text-xs">
                    {/* Damage */}
                    <div>
                      <div className="mb-1 flex items-center justify-between font-semibold">
                        <span className="text-slate-300">Power (Common–Rare)</span>
                        <span className="font-mono tabular-nums text-slate-100">
                          {currentCommon.damage}–{currentRare.damage}
                          {nextRare && (
                            <span className="ml-1.5 text-emerald-400">
                              +{nextRare.damage - currentRare.damage}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-sm bg-slate-800">
                        {nextRare && (
                          <div
                            className="absolute inset-y-0 left-0 bg-emerald-400/55"
                            style={{ width: `${nextDmgPct}%` }}
                          />
                        )}
                        <div
                          className="relative h-full transition-all duration-300"
                          style={{ width: `${dmgPct}%`, backgroundColor: currentTier.accent }}
                        />
                      </div>
                    </div>

                    {/* Range */}
                    <div>
                      <div className="mb-1 flex items-center justify-between font-semibold">
                        <span className="text-slate-300">Effective Range</span>
                        <span className="font-mono tabular-nums text-slate-100">
                          {currentRare.range}m
                          {nextRare && (
                            <span className="ml-1.5 text-emerald-400">
                              +{nextRare.range - currentRare.range}m
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-sm bg-slate-800">
                        {nextRare && (
                          <div
                            className="absolute inset-y-0 left-0 bg-emerald-400/55"
                            style={{ width: `${nextRngPct}%` }}
                          />
                        )}
                        <div
                          className="relative h-full bg-sky-400 transition-all duration-300"
                          style={{ width: `${rngPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Fire Rate */}
                    <div>
                      <div className="mb-1 flex items-center justify-between font-semibold">
                        <span className="text-slate-300">Fire Rate</span>
                        <span className="font-mono tabular-nums text-slate-100">
                          {currentRof}/s
                          {nextCommon && nextRof > currentRof && (
                            <span className="ml-1.5 text-emerald-400">
                              +{(nextRof - currentRof).toFixed(2)}/s
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-sm bg-slate-800">
                        {nextCommon && (
                          <div
                            className="absolute inset-y-0 left-0 bg-emerald-400/55"
                            style={{ width: `${nextRofPct}%` }}
                          />
                        )}
                        <div
                          className="relative h-full bg-amber-400 transition-all duration-300"
                          style={{ width: `${rofPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upgrade Action Button */}
                <div className="mt-4 pt-3 border-t border-slate-800/90">
                  {isMax ? (
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-400/50 bg-amber-500/15 py-2.5 text-xs font-extrabold text-amber-300">
                      <CheckCircle2 className="h-4 w-4" />
                      MAX MASTERWORK POWER (MK-V)
                    </div>
                  ) : nextTier && !levelMet ? (
                    <button
                      type="button"
                      disabled
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 py-2.5 text-xs font-bold text-slate-400 cursor-not-allowed whitespace-nowrap"
                    >
                      <Lock className="h-3.5 w-3.5 text-slate-500" />
                      Reach Player Lv.{nextTier.requiredPlayerLevel} for {nextTier.code}
                    </button>
                  ) : nextTier ? (
                    <button
                      type="button"
                      onClick={() => handleUpgrade(category)}
                      disabled={!canUpgrade}
                      className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-extrabold transition-colors whitespace-nowrap ${
                        canUpgrade
                          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md'
                          : 'border border-slate-700 bg-slate-900 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                      <span>
                        Upgrade to {nextTier.code} ({nextTier.label})
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-slate-950/25 px-1.5 py-0.5 font-mono tabular-nums">
                        <GoldCoinSvg size={13} />
                        {nextTier.cost}
                      </span>
                    </button>
                  ) : null}

                  {nextTier && levelMet && !canAfford && (
                    <div className="mt-1.5 text-center text-[11px] font-medium text-amber-400/80 tabular-nums">
                      Need {(nextTier.cost - progression.coins).toLocaleString()} more coins from arena battles
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Tip */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3.5 text-xs text-slate-400">
          <span>
            Earn Gold Coins &amp; XP by grabbing floor coin drops, knocking out fighters, claiming Vault loot, and winning rounds.
          </span>
          <span className="font-semibold text-amber-300">
            Upgrades apply immediately in Solo &amp; Multiplayer
          </span>
        </div>
      </div>
    </div>
  );
};
