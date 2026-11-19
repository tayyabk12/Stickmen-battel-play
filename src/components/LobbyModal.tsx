import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Link2,
  LogOut,
  Play,
  ShieldCheck,
} from 'lucide-react';
import {
  ACCESSORIES,
  MATCH_PRESETS,
  STICK_COLORS,
  TEAM_META,
  type AccessoryType,
  type GameMode,
  type PlayerCustomization,
  type RoomData,
  type RoomPlayerData,
  type TeamId,
} from '../types/game';
import { StickFigurePreview } from './StickFigureSvg';
import { TitleBackdropArena } from './TitleBackdropArena';

interface LobbyModalProps {
  room: RoomData;
  players: RoomPlayerData[];
  localUserId: string;
  customization: PlayerCustomization;
  busy: boolean;
  onUpdateCustomization: (next: PlayerCustomization) => void;
  onToggleReady: () => void;
  onChangeTeam: (team: 'red' | 'blue') => void;
  onChangeRoomConfig: (config: { gameMode?: GameMode; roundDurationSec?: number; totalRounds?: number }) => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

export const LobbyModal: React.FC<LobbyModalProps> = ({
  room,
  players,
  localUserId,
  customization,
  busy,
  onUpdateCustomization,
  onToggleReady,
  onChangeTeam,
  onChangeRoomConfig,
  onStartMatch,
  onLeaveRoom,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const isHost = room.hostId === localUserId;
  const isTdm = room.gameMode === 'tdm';
  const localPlayer = players.find((p) => p.playerId === localUserId);
  const readyCount = players.filter((p) => p.playerId === room.hostId || p.isReady).length;
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.playerId === room.hostId) return -1;
    if (b.playerId === room.hostId) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(room.roomId).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${room.roomId}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  const localTeam: TeamId = localPlayer?.team === 'blue' ? 'blue' : 'red';

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0E131A] text-slate-100">
      <TitleBackdropArena />
      <div className="pointer-events-none absolute inset-0 bg-[#0B0F17]/84" />

      <div className="relative z-10 flex h-full w-full items-center justify-center overflow-y-auto p-4 sm:p-8">
        <div className="w-full max-w-4xl rounded-xl border border-slate-700/90 bg-[#141B26] p-6 shadow-2xl sm:p-8">
          {/* Header Row: Room Code + Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="text-xs font-semibold text-slate-400">
                {isTdm ? 'Team Deathmatch Room' : '4-Round Survival Room'} · {room.totalRounds} Rounds · {players.length}/{room.maxPlayers} Players
              </div>
              <div className="mt-1 flex items-center gap-3">
                <span className="font-mono text-3xl font-bold tracking-[0.2em] text-amber-400 sm:text-4xl">
                  {room.roomId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#1B2432] px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-amber-400/70 hover:text-amber-300 whitespace-nowrap"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedCode ? 'Copied' : 'Copy Code'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#1B2432] px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-amber-400/70 hover:text-amber-300 whitespace-nowrap"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
                  {copiedLink ? 'Link Copied' : 'Invite Link'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onLeaveRoom}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              Leave Room
            </button>
          </div>

          {/* Body: 2-Column Roster + Controls */}
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Roster Grid */}
            <div className="lg:col-span-7">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-400">
                <div className="flex items-center gap-2">
                  <span>Joined Fighters</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`tabular-nums transition-colors duration-300 ${
                      readyCount === players.length && players.length > 0
                        ? 'text-emerald-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {readyCount}/{players.length} Ready
                  </span>
                </div>
                <span>Code {room.roomId} works on Web & Android</span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {sortedPlayers.map((p) => {
                  const isMe = p.playerId === localUserId;
                  const isPlayerHost = p.playerId === room.hostId;
                  const isReady = !isPlayerHost && p.isReady;
                  const isWaiting = !isPlayerHost && !p.isReady;
                  const pTeam: 'red' | 'blue' = p.team === 'blue' ? 'blue' : 'red';

                  const cardStateClasses = isPlayerHost
                    ? 'border-amber-500/65 bg-amber-950/20 shadow-[inset_0_1px_0_0_rgba(251,191,36,0.22)]'
                    : isReady
                      ? 'border-emerald-500/70 bg-emerald-950/25 lobby-card-ready'
                      : 'border-rose-500/45 bg-rose-950/15 lobby-card-waiting';

                  const localRingClasses = isMe
                    ? isReady
                      ? 'ring-1 ring-emerald-400/75 ring-offset-2 ring-offset-[#141B26]'
                      : isPlayerHost
                        ? 'ring-1 ring-amber-400/75 ring-offset-2 ring-offset-[#141B26]'
                        : 'ring-1 ring-rose-400/75 ring-offset-2 ring-offset-[#141B26]'
                    : '';

                  const badgeClasses = isPlayerHost
                    ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                    : isReady
                      ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                      : 'border-rose-400/60 bg-rose-500/20 text-rose-200';

                  return (
                    <div
                      key={p.playerId}
                      className={`relative flex flex-col items-center overflow-hidden rounded-lg border p-3 text-center transition-all duration-300 ${cardStateClasses} ${localRingClasses}`}
                    >
                      {/* Top state accent bar */}
                      <div
                        className={`absolute inset-x-0 top-0 h-1 transition-colors duration-300 ${
                          isPlayerHost
                            ? 'bg-amber-400'
                            : isReady
                              ? 'bg-emerald-400'
                              : 'bg-rose-500/80 animate-pulse'
                        }`}
                      />

                      <StickFigurePreview
                        color={p.color}
                        accessory={p.accessory}
                        animState={p.isReady || isPlayerHost ? 'run' : 'idle'}
                        size={62}
                      />

                      <div className="mt-1 flex w-full items-center justify-center gap-1 truncate text-xs font-bold text-slate-100">
                        <span className="truncate">{p.displayName}</span>
                        {isMe && (
                          <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                            (You)
                          </span>
                        )}
                      </div>

                      {isTdm && (
                        <div
                          className="mt-0.5 text-[10px] font-bold tracking-wide"
                          style={{ color: TEAM_META[pTeam].color }}
                        >
                          {TEAM_META[pTeam].name}
                        </div>
                      )}

                      {/* High-Contrast Status Badge */}
                      <div
                        role="status"
                        aria-label={
                          isPlayerHost
                            ? `${p.displayName} is the host and ready`
                            : isReady
                              ? `${p.displayName} is ready`
                              : `${p.displayName} is not ready`
                        }
                        className={`mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${badgeClasses}`}
                      >
                        {isPlayerHost ? (
                          <>
                            <Crown className="h-3 w-3 shrink-0" />
                            <span>Host</span>
                          </>
                        ) : isReady ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                            <span>Ready</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3 shrink-0 animate-pulse" />
                            <span>{isWaiting ? 'Not Ready' : ''}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {Array.from({ length: Math.max(0, 4 - sortedPlayers.length) }).map((_, i) => (
                  <div
                    key={`empty_${i}`}
                    className="flex min-h-[124px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-[#0F151D]/60 p-3 text-center text-xs text-slate-500"
                  >
                    Open Slot
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Customizer, Team Switch & Match Settings */}
            <div className="flex flex-col justify-between gap-4 border-t border-slate-800 pt-5 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div className="space-y-4">
                {isTdm && (
                  <div>
                    <div className="mb-1.5 text-xs font-semibold text-slate-300">Your Team</div>
                    <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-[#10161F] p-1">
                      {(['red', 'blue'] as const).map((tm) => {
                        const active = localTeam === tm;
                        return (
                          <button
                            key={tm}
                            type="button"
                            onClick={() => onChangeTeam(tm)}
                            className={`rounded-md py-1.5 text-xs font-bold transition-colors ${
                              active ? 'text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                            }`}
                            style={
                              active
                                ? {
                                    backgroundColor: TEAM_META[tm].bg,
                                    boxShadow: `inset 0 0 0 1px ${TEAM_META[tm].border}`,
                                    color: TEAM_META[tm].color,
                                  }
                                : undefined
                            }
                          >
                            {TEAM_META[tm].name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-1.5 text-xs font-semibold text-slate-300">Your Ink Color</div>
                  <div className="grid grid-cols-8 gap-1.5">
                    {STICK_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => onUpdateCustomization({ ...customization, color: c.hex })}
                        title={c.name}
                        className={`h-7 w-full rounded ${
                          customization.color === c.hex
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-[#141B26]'
                            : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-xs font-semibold text-slate-300">Accessory</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ACCESSORIES.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() =>
                          onUpdateCustomization({
                            ...customization,
                            accessory: acc.id as AccessoryType,
                          })
                        }
                        className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          customization.accessory === acc.id
                            ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                            : 'border-slate-700 bg-[#10161F] text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {acc.label}
                      </button>
                    ))}
                  </div>
                </div>

                {isHost && (
                  <div className="space-y-3 border-t border-slate-800/80 pt-3">
                    <div>
                      <div className="mb-1.5 text-xs font-semibold text-slate-300">Game Format</div>
                      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-[#10161F] p-1">
                        <button
                          type="button"
                          onClick={() =>
                            onChangeRoomConfig({
                              gameMode: 'tdm',
                              totalRounds: 4,
                              roundDurationSec: room.roundDurationSec,
                            })
                          }
                          className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                            room.gameMode === 'tdm'
                              ? 'bg-slate-700 text-white'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          TDM (4 Rounds)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onChangeRoomConfig({
                              gameMode: 'survival',
                              totalRounds: 4,
                              roundDurationSec: room.roundDurationSec,
                            })
                          }
                          className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                            room.gameMode === 'survival'
                              ? 'bg-slate-700 text-white'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Survival (4 Rounds)
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 text-xs font-semibold text-slate-300">
                        Match Length (4 Timed Phases)
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[#10161F] p-1">
                        {MATCH_PRESETS.map((preset) => (
                          <button
                            key={preset.roundSec}
                            type="button"
                            onClick={() =>
                              onChangeRoomConfig({
                                gameMode: room.gameMode,
                                totalRounds: preset.rounds,
                                roundDurationSec: preset.roundSec,
                              })
                            }
                            className={`rounded-md py-1.5 text-[11px] font-semibold tabular-nums transition-colors ${
                              room.roundDurationSec === preset.roundSec
                                ? 'bg-slate-700 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {preset.label.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                {isHost ? (
                  <button
                    type="button"
                    onClick={onStartMatch}
                    disabled={busy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    {busy
                      ? 'Launching Arena...'
                      : players.length < 2
                        ? 'Start Solo Sync Test'
                        : `Start 4-Round Match (${players.length} Players)`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onToggleReady}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold transition-colors ${
                      localPlayer?.isReady
                        ? 'border border-emerald-500/60 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                        : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {localPlayer?.isReady ? 'Ready — Waiting for Host' : 'Mark Ready'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
