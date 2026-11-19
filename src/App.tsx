import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  DEFAULT_PLAYER_PROGRESSION,
  DEFAULT_ROUND_DURATION_SEC,
  DEFAULT_TOTAL_ROUNDS,
  GUN_UPGRADE_TIERS,
  MAX_GUN_LEVEL,
  MAX_PLAYER_LEVEL,
  STICK_COLORS,
  applyXpGain,
  type AppScreen,
  type GameMode,
  type MatchSummary,
  type PlayerCustomization,
  type PlayerProgression,
  type RoomData,
  type RoomPlayerData,
  type UserProfile,
  type WeaponCategory,
} from './types/game';
import {
  auth,
  createPrivateRoom,
  fetchRoomByCode,
  joinPrivateRoomPlayer,
  leavePrivateRoom,
  loadOrCreateUserProfile,
  recordUserMatchResult,
  sanitizeAccessory,
  sanitizeColor,
  sanitizeDisplayName,
  sanitizeRoomCode,
  saveUserCustomization,
  saveUserProgression,
  signInAsGuest,
  signInWithGoogle,
  signOutUser,
  startRoomMatch,
  subscribeToRoom,
  subscribeToRoomPlayers,
  updateLobbyPlayerProfile,
  updateLobbyRoomConfig,
} from './lib/firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TitleScreen } from './components/TitleScreen';
import { LobbyModal } from './components/LobbyModal';
import { ArenaView } from './components/ArenaView';
import { MatchSummaryModal } from './components/MatchSummaryModal';
import { ArmoryModal } from './components/ArmoryModal';

const LOCAL_CUSTOM_KEY = 'los_fighter_custom_v1';
const LOCAL_PROGRESSION_KEY = 'los_progression_v1';

function loadLocalProgression(): PlayerProgression {
  try {
    const raw = localStorage.getItem(LOCAL_PROGRESSION_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        coins: Math.max(0, Math.min(1000000, Math.round(Number(p.coins ?? 0)))),
        xp: Math.max(0, Math.min(100000, Math.round(Number(p.xp ?? 0)))),
        level: Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.round(Number(p.level ?? 1)))),
        gunLevels: {
          close: Math.max(1, Math.min(MAX_GUN_LEVEL, Math.round(Number(p.gunLevels?.close ?? 1)))),
          mid: Math.max(1, Math.min(MAX_GUN_LEVEL, Math.round(Number(p.gunLevels?.mid ?? 1)))),
          long: Math.max(1, Math.min(MAX_GUN_LEVEL, Math.round(Number(p.gunLevels?.long ?? 1)))),
        },
      };
    }
  } catch {
    // Ignore storage parse failures
  }
  return {
    ...DEFAULT_PLAYER_PROGRESSION,
    gunLevels: { ...DEFAULT_PLAYER_PROGRESSION.gunLevels },
  };
}

function saveLocalProgression(prog: PlayerProgression): void {
  try {
    localStorage.setItem(LOCAL_PROGRESSION_KEY, JSON.stringify(prog));
  } catch {
    // Ignore storage failures
  }
}

function loadLocalCustomization(): PlayerCustomization {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        displayName: sanitizeDisplayName(String(parsed.displayName || 'Striker')),
        color: sanitizeColor(String(parsed.color || STICK_COLORS[0].hex)),
        accessory: sanitizeAccessory(String(parsed.accessory || 'crown')),
      };
    }
  } catch {
    // Ignore storage parse failures
  }
  return {
    displayName: 'Striker',
    color: STICK_COLORS[0].hex,
    accessory: 'crown',
  };
}

function getInitialRoomCodeFromUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    return code ? sanitizeRoomCode(code) : '';
  } catch {
    return '';
  }
}

function LastOneStandingApp() {
  const [screen, setScreen] = useState<AppScreen>('TITLE');
  const [soloRunId, setSoloRunId] = useState(1);
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>('tdm');
  const [selectedRoundDurationSec, setSelectedRoundDurationSec] = useState<number>(
    DEFAULT_ROUND_DURATION_SEC
  );

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [customization, setCustomization] = useState<PlayerCustomization>(loadLocalCustomization);
  const [progression, setProgression] = useState<PlayerProgression>(loadLocalProgression);
  const [showArmory, setShowArmory] = useState(false);

  const [initialRoomCode] = useState<string>(getInitialRoomCodeFromUrl);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayerData[]>([]);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<MatchSummary | null>(null);

  const saveDebounceRef = useRef<number | null>(null);
  const customizationRef = useRef(customization);
  customizationRef.current = customization;
  const progressionRef = useRef(progression);
  progressionRef.current = progression;

  // Observe Firebase Auth state & load persisted customization profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          const fallback: PlayerCustomization = {
            ...customizationRef.current,
            displayName: nextUser.displayName
              ? sanitizeDisplayName(nextUser.displayName.split(' ')[0])
              : customizationRef.current.displayName,
          };
          const loaded = await loadOrCreateUserProfile(
            nextUser.uid,
            fallback,
            progressionRef.current
          );
          setProfile(loaded);
          const nextCustom: PlayerCustomization = {
            displayName: loaded.displayName,
            color: loaded.color,
            accessory: loaded.accessory,
          };
          setCustomization(nextCustom);
          // Preserve highest local/cloud progression so offline Solo coins are never lost on sign-in
          const mergedProg: PlayerProgression = {
            coins: Math.max(loaded.coins, progressionRef.current.coins),
            level: Math.max(loaded.level, progressionRef.current.level),
            xp:
              loaded.level > progressionRef.current.level
                ? loaded.xp
                : progressionRef.current.level > loaded.level
                  ? progressionRef.current.xp
                  : Math.max(loaded.xp, progressionRef.current.xp),
            gunLevels: {
              close: Math.max(loaded.gunLevels.close, progressionRef.current.gunLevels.close),
              mid: Math.max(loaded.gunLevels.mid, progressionRef.current.gunLevels.mid),
              long: Math.max(loaded.gunLevels.long, progressionRef.current.gunLevels.long),
            },
          };
          setProgression(mergedProg);
          saveLocalProgression(mergedProg);
          if (
            mergedProg.coins !== loaded.coins ||
            mergedProg.level !== loaded.level ||
            mergedProg.gunLevels.close !== loaded.gunLevels.close ||
            mergedProg.gunLevels.mid !== loaded.gunLevels.mid ||
            mergedProg.gunLevels.long !== loaded.gunLevels.long
          ) {
            void saveUserProgression(nextUser.uid, mergedProg);
          }
          try {
            localStorage.setItem(LOCAL_CUSTOM_KEY, JSON.stringify(nextCustom));
          } catch {
            // Ignore storage errors
          }
        } catch (err) {
          console.error('Failed loading user profile:', err);
        }
      } else {
        setProfile(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Subscribe to active multiplayer room + players ONLY when authenticated & room joined
  useEffect(() => {
    if (!user || !activeRoomId) {
      setRoom(null);
      setRoomPlayers([]);
      return;
    }

    const unsubRoom = subscribeToRoom(activeRoomId, (nextRoom) => {
      if (!nextRoom) {
        setActiveRoomId(null);
        setScreen('TITLE');
        setErrorMessage('The room was closed by the host.');
        return;
      }
      setRoom(nextRoom);
      if (nextRoom.status === 'playing') {
        setScreen('PLAYING_MULTI');
      }
    });

    const unsubPlayers = subscribeToRoomPlayers(activeRoomId, (players) => {
      setRoomPlayers(players);
    });

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [user, activeRoomId]);

  // Persist customization to localStorage immediately & debounce Firestore sync
  const handleUpdateCustomization = useCallback(
    (next: PlayerCustomization) => {
      const cleaned: PlayerCustomization = {
        displayName: next.displayName.slice(0, 20),
        color: sanitizeColor(next.color),
        accessory: sanitizeAccessory(next.accessory),
      };
      setCustomization(cleaned);
      try {
        localStorage.setItem(LOCAL_CUSTOM_KEY, JSON.stringify(cleaned));
      } catch {
        // Ignore storage errors
      }

      if (user) {
        if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = window.setTimeout(() => {
          const safe = { ...cleaned, displayName: sanitizeDisplayName(cleaned.displayName) };
          void saveUserCustomization(user.uid, safe);
          setProfile((prev) => (prev ? { ...prev, ...safe } : prev));
          if (activeRoomId && room?.status === 'lobby') {
            const me = roomPlayers.find((p) => p.playerId === user.uid);
            void updateLobbyPlayerProfile(activeRoomId, user.uid, safe, Boolean(me?.isReady), me?.team);
          }
        }, 280);
      }
    },
    [user, activeRoomId, room?.status, roomPlayers]
  );

  const handleSignInGoogle = async () => {
    setErrorMessage(null);
    setBusyAction('google');
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      if (!msg.includes('popup-closed-by-user')) {
        setErrorMessage(msg);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleSignInGuest = async () => {
    setErrorMessage(null);
    setBusyAction('guest');
    try {
      await signInAsGuest();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('operation-not-allowed') || msg.includes('admin-restricted-operation')) {
        setErrorMessage(
          'Guest Anonymous sign-in is not enabled in Firebase Console yet. Enable it under Authentication → Sign-in method → Anonymous, or use Sign in with Google right now.'
        );
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleSignOut = async () => {
    if (activeRoomId && user) {
      await leavePrivateRoom(activeRoomId, user.uid);
    }
    setActiveRoomId(null);
    setScreen('TITLE');
    await signOutUser();
  };

  const handleCreateRoom = async () => {
    if (!user) return;
    setErrorMessage(null);
    setBusyAction('create');
    try {
      const safeCustom = {
        ...customization,
        displayName: sanitizeDisplayName(customization.displayName),
      };
      const created = await createPrivateRoom(
        user.uid,
        safeCustom,
        selectedGameMode,
        selectedRoundDurationSec,
        DEFAULT_TOTAL_ROUNDS
      );
      setActiveRoomId(created.roomId);
      setRoom(created);
      setScreen('LOBBY');
      setSummary(null);
      window.history.replaceState({}, '', `${window.location.pathname}?room=${created.roomId}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not create room.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleJoinRoom = async (rawCode: string) => {
    if (!user) return;
    setErrorMessage(null);
    setBusyAction('join');
    try {
      const code = sanitizeRoomCode(rawCode);
      const found = await fetchRoomByCode(code);
      if (!found) {
        setErrorMessage(`Room "${code}" was not found. Double-check the code.`);
        return;
      }
      if (found.status !== 'lobby') {
        setErrorMessage(
          found.status === 'playing'
            ? `Room "${code}" is already in a match.`
            : `Room "${code}" has already ended.`
        );
        return;
      }
      const safeCustom = {
        ...customization,
        displayName: sanitizeDisplayName(customization.displayName),
      };
      // Default joiners to Team Cobalt in TDM so 2-player rooms auto-balance 1v1
      await joinPrivateRoomPlayer(
        found.roomId,
        user.uid,
        safeCustom,
        false,
        found.gameMode === 'tdm' ? 'blue' : 'none'
      );
      setActiveRoomId(found.roomId);
      setRoom(found);
      setScreen('LOBBY');
      setSummary(null);
      window.history.replaceState({}, '', `${window.location.pathname}?room=${found.roomId}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to join room.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleLeaveRoom = async () => {
    if (activeRoomId && user) {
      await leavePrivateRoom(activeRoomId, user.uid);
    }
    setActiveRoomId(null);
    setRoom(null);
    setRoomPlayers([]);
    setSummary(null);
    setScreen('TITLE');
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleToggleReady = async () => {
    if (!user || !activeRoomId) return;
    const me = roomPlayers.find((p) => p.playerId === user.uid);
    const safeCustom = {
      ...customization,
      displayName: sanitizeDisplayName(customization.displayName),
    };
    await updateLobbyPlayerProfile(activeRoomId, user.uid, safeCustom, !me?.isReady, me?.team);
  };

  const handleChangeTeam = async (team: 'red' | 'blue') => {
    if (!user || !activeRoomId) return;
    const me = roomPlayers.find((p) => p.playerId === user.uid);
    const safeCustom = {
      ...customization,
      displayName: sanitizeDisplayName(customization.displayName),
    };
    await updateLobbyPlayerProfile(activeRoomId, user.uid, safeCustom, Boolean(me?.isReady), team);
  };

  const handleChangeRoomConfig = async (config: {
    gameMode?: GameMode;
    totalRounds?: number;
    roundDurationSec?: number;
  }) => {
    if (!room) return;
    await updateLobbyRoomConfig(room.roomId, {
      gameMode: config.gameMode ?? room.gameMode,
      totalRounds: config.totalRounds ?? room.totalRounds,
      roundDurationSec: config.roundDurationSec ?? room.roundDurationSec,
    });
  };

  const handleStartRoomMatch = async () => {
    if (!room) return;
    setBusyAction('start');
    try {
      await startRoomMatch(room);
    } finally {
      setBusyAction(null);
    }
  };

  const handleStartSolo = useCallback(() => {
    setSummary(null);
    setSoloRunId((id) => id + 1);
    setScreen('PLAYING_SOLO');
  }, []);

  const handleUpgradeGun = useCallback(
    (category: WeaponCategory): boolean => {
      const current = progressionRef.current;
      const curLv = current.gunLevels[category];
      if (curLv >= MAX_GUN_LEVEL) return false;
      const nextTier = GUN_UPGRADE_TIERS[curLv];
      if (!nextTier) return false;
      if (current.level < nextTier.requiredPlayerLevel) return false;
      if (current.coins < nextTier.cost) return false;

      const updated: PlayerProgression = {
        ...current,
        coins: current.coins - nextTier.cost,
        gunLevels: {
          ...current.gunLevels,
          [category]: curLv + 1,
        },
      };
      setProgression(updated);
      saveLocalProgression(updated);
      if (user) {
        void saveUserProgression(user.uid, updated);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                coins: updated.coins,
                gunLevels: updated.gunLevels,
              }
            : prev
        );
      }
      return true;
    },
    [user]
  );

  const handleMatchComplete = useCallback(
    (result: MatchSummary) => {
      setSummary(result);

      const prevProg = progressionRef.current;
      const xpOutcome = applyXpGain(prevProg.level, prevProg.xp, result.xpEarned);
      const nextProg: PlayerProgression = {
        ...prevProg,
        coins: Math.min(1000000, prevProg.coins + Math.max(0, result.coinsEarned)),
        level: xpOutcome.level,
        xp: xpOutcome.xp,
      };
      setProgression(nextProg);
      saveLocalProgression(nextProg);

      if (user && profile) {
        void recordUserMatchResult(
          user.uid,
          result.won,
          profile.wins,
          profile.matchesPlayed,
          nextProg
        );
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                wins: prev.wins + (result.won ? 1 : 0),
                matchesPlayed: prev.matchesPlayed + 1,
                coins: nextProg.coins,
                xp: nextProg.xp,
                level: nextProg.level,
                gunLevels: nextProg.gunLevels,
              }
            : prev
        );
      }
    },
    [user, profile]
  );

  const handlePlayAgain = async () => {
    if (summary?.mode === 'solo') {
      setSummary(null);
      setSoloRunId((id) => id + 1);
      setScreen('PLAYING_SOLO');
    } else {
      setSummary(null);
      setActiveRoomId(null);
      setRoom(null);
      setRoomPlayers([]);
      if (user) {
        await handleCreateRoom();
      } else {
        setScreen('TITLE');
      }
    }
  };

  const handleExitToTitle = () => {
    setSummary(null);
    if (screen === 'PLAYING_MULTI' || screen === 'LOBBY') {
      void handleLeaveRoom();
    } else {
      setScreen('TITLE');
    }
  };

  const effectiveUid = user?.uid ?? 'local_solo_player';
  const safeCustomization: PlayerCustomization = {
    ...customization,
    displayName: sanitizeDisplayName(customization.displayName),
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0E131A]">
      {screen === 'TITLE' && (
        <TitleScreen
          user={user}
          authLoading={authLoading}
          profile={profile}
          customization={customization}
          progression={progression}
          armoryOpen={showArmory}
          selectedGameMode={selectedGameMode}
          selectedRoundDurationSec={selectedRoundDurationSec}
          initialRoomCode={initialRoomCode}
          busyAction={busyAction}
          errorMessage={errorMessage}
          onUpdateCustomization={handleUpdateCustomization}
          onOpenArmory={() => setShowArmory(true)}
          onChangeGameMode={setSelectedGameMode}
          onChangeRoundDurationSec={setSelectedRoundDurationSec}
          onStartSolo={handleStartSolo}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onSignInGoogle={handleSignInGoogle}
          onSignInGuest={handleSignInGuest}
          onSignOut={handleSignOut}
          onClearError={() => setErrorMessage(null)}
        />
      )}

      {screen === 'LOBBY' && room && user && (
        <LobbyModal
          room={room}
          players={roomPlayers}
          localUserId={user.uid}
          customization={customization}
          busy={busyAction === 'start'}
          onUpdateCustomization={handleUpdateCustomization}
          onToggleReady={handleToggleReady}
          onChangeTeam={handleChangeTeam}
          onChangeRoomConfig={handleChangeRoomConfig}
          onStartMatch={handleStartRoomMatch}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {screen === 'PLAYING_SOLO' && (
        <ArenaView
          key={`solo_${soloRunId}`}
          mode="solo"
          gameMode={selectedGameMode}
          totalRounds={DEFAULT_TOTAL_ROUNDS}
          roundDurationSec={selectedRoundDurationSec}
          localUserId={effectiveUid}
          localCustomization={safeCustomization}
          progression={progression}
          onMatchComplete={handleMatchComplete}
          onExitMatch={handleExitToTitle}
        />
      )}

      {screen === 'PLAYING_MULTI' && room && user && (
        <ArenaView
          key={`multi_${room.roomId}`}
          mode="multi"
          gameMode={room.gameMode}
          totalRounds={room.totalRounds}
          roundDurationSec={room.roundDurationSec}
          localUserId={user.uid}
          localCustomization={safeCustomization}
          progression={progression}
          room={room}
          roomPlayers={roomPlayers}
          onMatchComplete={handleMatchComplete}
          onExitMatch={handleExitToTitle}
        />
      )}

      {summary && (
        <MatchSummaryModal
          summary={summary}
          progression={progression}
          onOpenArmory={() => setShowArmory(true)}
          onPlayAgain={handlePlayAgain}
          onBackToTitle={handleExitToTitle}
        />
      )}

      {showArmory && (
        <ArmoryModal
          progression={progression}
          onUpgradeGun={handleUpgradeGun}
          onClose={() => setShowArmory(false)}
        />
      )}
    </main>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LastOneStandingApp />
    </ErrorBoundary>
  );
}
