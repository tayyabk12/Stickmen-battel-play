import React from 'react';
import { Award, Crosshair, Home, RotateCcw, Skull, Sparkles, Trophy, Zap } from 'lucide-react';
import {
  getXpForNextLevel,
  MAX_PLAYER_LEVEL,
  TEAM_META,
  type MatchSummary,
  type PlayerProgression,
} from '../types/game';
import { StickFigurePreview } from './StickFigureSvg';
import { GoldCoinSvg } from './WeaponGraphicSvg';

interface MatchSummaryModalProps {
  summary: MatchSummary;
  progression: PlayerProgression;
  onOpenArmory: () => void;
  onPlayAgain: () => void;
  onBackToTitle: () => void;
}

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const MatchSummaryModal: React.FC<MatchSummaryModalProps> = ({
  summary,
  progression,
  onOpenArmory,
  onPlayAgain,
  onBackToTitle,
}) => {
  const isTdm = summary.gameMode === 'tdm';
  const sortedAvatars = [...summary.avatarScores].sort(
    (a, b) => b.points - a.points || b.kills - a.kills || a.deaths - b.deaths
  );
  const nextLevelXp = getXpForNextLevel(progression.level);
  const xpPct =
    progression.level >= MAX_PLAYER_LEVEL
      ? 100
      : Math.min(100, Math.round((progression.xp / Math.max(1, nextLevelXp)) * 100));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#090D14]/88 p-4">
      <div className="my-auto w-full max-w-3xl rounded-xl border border-slate-700 bg-[#151C27] p-6 shadow-2xl sm:p-7">
        {/* Match Outcome Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                summary.won ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
              }`}
            >
              {summary.won ? <Trophy className="h-6 w-6" /> : <Skull className="h-6 w-6" />}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400">
                {isTdm ? 'Team Deathmatch' : 'Survival Points'} · {summary.totalRounds} Rounds · {formatSec(summary.timeSurvivedSec)}
              </div>
              <h2 className="font-display text-3xl font-extrabold tracking-wide text-slate-50">
                {summary.won ? 'Victory' : 'Match Complete'}
              </h2>
              <p className="text-sm text-slate-300">
                Winner: <span className="font-bold text-amber-300">{summary.winnerName}</span>
                {summary.mvpName && (
                  <>
                    <span className="mx-2 text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1 text-slate-300">
                      <Award className="h-3.5 w-3.5 text-amber-400" />
                      MVP: <strong className="text-white">{summary.mvpName}</strong>
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* TDM Team Scoreboard Summary */}
          {isTdm && (
            <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-[#10161F] px-4 py-2.5">
              <div className="text-right">
                <div className="text-[11px] font-bold text-red-400">CRIMSON</div>
                <div className="font-display text-2xl font-extrabold text-slate-100 tabular-nums">
                  {summary.redScore}
                </div>
                <div className="text-[10px] text-slate-400 tabular-nums">
                  {summary.redRoundsWon} Rds Won
                </div>
              </div>
              <div className="text-xs font-bold text-slate-600">VS</div>
              <div className="text-left">
                <div className="text-[11px] font-bold text-blue-400">COBALT</div>
                <div className="font-display text-2xl font-extrabold text-slate-100 tabular-nums">
                  {summary.blueScore}
                </div>
                <div className="text-[10px] text-slate-400 tabular-nums">
                  {summary.blueRoundsWon} Rds Won
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Coins, XP & Level Progression Rewards */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-500/35 bg-[#10161F] px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <GoldCoinSvg size={22} />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Coins Earned
                </div>
                <div className="font-mono text-base font-extrabold leading-none text-amber-300 tabular-nums">
                  +{summary.coinsEarned.toLocaleString()}
                  <span className="ml-2 text-xs font-semibold text-slate-400">
                    (Total {progression.coins.toLocaleString()})
                  </span>
                </div>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800" />

            <div className="min-w-[165px]">
              <div className="flex items-center justify-between gap-3 text-xs font-bold">
                <span className="inline-flex items-center gap-1 text-sky-300">
                  <Zap className="h-3.5 w-3.5" />
                  Level {progression.level}
                </span>
                <span className="font-mono text-[11px] text-emerald-400 tabular-nums">
                  +{summary.xpEarned} XP
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-sky-400 transition-all duration-300"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            </div>
          </div>

          {summary.leveledUp && (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/60 bg-amber-500/15 px-3 py-1.5 text-xs font-extrabold text-amber-300">
              <Sparkles className="h-3.5 w-3.5" />
              LEVEL UP! NOW LV.{progression.level}
            </div>
          )}
        </div>

        {/* 4-Round Phase Breakdown Strip */}
        {summary.roundsHistory.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {summary.roundsHistory.map((rd) => (
              <div
                key={rd.round}
                className="rounded-lg border border-slate-800 bg-[#10161F] px-3 py-2"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                  <span>Round {rd.round}</span>
                  {isTdm && (
                    <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                      {rd.redRoundPoints}–{rd.blueRoundPoints}
                    </span>
                  )}
                </div>
                <div
                  className="mt-0.5 truncate text-xs font-bold"
                  style={{ color: rd.winnerAccent }}
                >
                  {rd.winnerLabel}
                </div>
                <div className="truncate text-[10px] text-slate-400">
                  Top: {rd.topAvatarName} ({rd.topAvatarPoints} pts)
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Per-Avatar Calculated Leaderboard */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Per-Avatar Match Calculation</span>
            <span>Kill +100 · Round Win +150 · Rare Vault +50 · 10 Dmg +1</span>
          </div>

          <div className="max-h-[260px] overflow-y-auto rounded-lg border border-slate-800 bg-[#10161F]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-slate-800 bg-[#131A24] text-[11px] font-semibold text-slate-400">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Avatar</th>
                  {isTdm && <th className="px-3 py-2">Team</th>}
                  <th className="px-3 py-2 text-right">Kills</th>
                  <th className="px-3 py-2 text-right">Deaths</th>
                  <th className="px-3 py-2 text-right">Damage</th>
                  <th className="px-3 py-2 text-right">Rds Won</th>
                  <th className="px-3 py-2 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {sortedAvatars.map((av, idx) => {
                  const teamInfo = av.team !== 'none' ? TEAM_META[av.team] : null;
                  return (
                    <tr
                      key={av.id}
                      className={av.isLocal ? 'bg-amber-500/10 text-slate-50' : 'text-slate-200'}
                    >
                      <td className="px-3 py-2 font-mono font-bold text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#161F2D]">
                            <StickFigurePreview
                              color={av.color}
                              accessory={av.accessory}
                              animState={idx === 0 ? 'run' : 'idle'}
                              size={30}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-bold text-slate-100">
                              {av.displayName}
                              {av.isLocal && (
                                <span className="ml-1.5 text-[10px] font-semibold text-amber-400">
                                  (You)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      {isTdm && (
                        <td className="px-3 py-2 font-semibold" style={{ color: teamInfo?.color }}>
                          {teamInfo?.short ?? '—'}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400 tabular-nums">
                        {av.kills}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-400 tabular-nums">
                        {av.deaths}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300 tabular-nums">
                        {av.damageDealt}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300 tabular-nums">
                        {av.roundWins}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm font-extrabold text-amber-300 tabular-nums">
                        {av.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={onPlayAgain}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap"
          >
            <RotateCcw className="h-4 w-4" />
            {summary.mode === 'multi' ? 'New Room' : 'Play Again'}
          </button>
          <button
            type="button"
            onClick={onOpenArmory}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/60 bg-amber-500/15 px-4 py-2.5 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-500/25 whitespace-nowrap shrink-0"
          >
            <Crosshair className="h-4 w-4" />
            Upgrade Guns
          </button>
          <button
            type="button"
            onClick={onBackToTitle}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#1B2432] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Home className="h-4 w-4" />
            Menu
          </button>
        </div>
      </div>
    </div>
  );
};
