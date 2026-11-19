import type { LootRarity, PickupType, WeaponCategory } from '../types/game';

/**
 * Procedural Web Audio API sound synthesizer for LastOneStanding.
 * Zero external audio files; category-distinct weapon, utility, and rarity feedback.
 */

class GameAudioEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private faaahAudio: HTMLAudioElement | null = null;
  private mistriAudio: HTMLAudioElement | null = null;
  private chachaAudio: HTMLAudioElement | null = null;
  private gameStartAudio: HTMLAudioElement | null = null;
  private victorySongAudio: HTMLAudioElement | null = null;
  private activeLongClip: HTMLAudioElement | null = null;

  constructor() {
    try {
      const saved = localStorage.getItem('los_muted');
      if (saved === '1') this.muted = true;
    } catch {
      // Ignore storage access failures
    }
    this.preloadCustomClips();
  }

  private preloadCustomClips(): void {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    try {
      this.faaahAudio = new Audio('/sounds/faaah.mp3');
      this.faaahAudio.preload = 'auto';
      this.faaahAudio.volume = 0.85;

      this.mistriAudio = new Audio('/assets/aistudio/mistri-man-jao_6VOMK5Ga_dd5a5d37.mp3');
      this.mistriAudio.preload = 'auto';
      this.mistriAudio.volume = 0.88;

      this.chachaAudio = new Audio('/assets/aistudio/chacha-ahh_6T5NLJ4B_44a6b105.mp3');
      this.chachaAudio.preload = 'auto';
      this.chachaAudio.volume = 0.9;

      this.gameStartAudio = new Audio('/sounds/game-start.mp3');
      this.gameStartAudio.preload = 'auto';
      this.gameStartAudio.volume = 0.85;

      this.victorySongAudio = new Audio('/sounds/win-song.mp3');
      this.victorySongAudio.preload = 'auto';
      this.victorySongAudio.volume = 0.85;
    } catch {
      // Ignore environments without HTMLAudioElement support
    }
  }

  public stopCustomClips(): void {
    if (this.activeLongClip) {
      try {
        this.activeLongClip.pause();
        this.activeLongClip.currentTime = 0;
      } catch {
        // Ignore playback errors
      }
      this.activeLongClip = null;
    }
    for (const clip of [
      this.mistriAudio,
      this.chachaAudio,
      this.gameStartAudio,
      this.victorySongAudio,
    ]) {
      if (clip) {
        try {
          clip.pause();
          clip.currentTime = 0;
        } catch {
          // Ignore
        }
      }
    }
  }

  public playKillFaaah(): void {
    if (this.muted || typeof Audio === 'undefined') return;
    try {
      // Clone from preloaded template so rapid double/triple kills fire crisply without cutting out
      const clip = this.faaahAudio
        ? (this.faaahAudio.cloneNode(true) as HTMLAudioElement)
        : new Audio('/sounds/faaah.mp3');
      clip.volume = 0.88;
      clip.play().catch(() => {});
    } catch {
      // Ignore autoplay restrictions
    }
  }

  public playMistriMaanJao(): void {
    if (this.muted || typeof Audio === 'undefined') return;
    try {
      this.stopCustomClips();
      if (!this.mistriAudio) {
        this.mistriAudio = new Audio('/assets/aistudio/mistri-man-jao_6VOMK5Ga_dd5a5d37.mp3');
      }
      this.mistriAudio.volume = 0.88;
      this.mistriAudio.currentTime = 0;
      this.activeLongClip = this.mistriAudio;
      this.mistriAudio.play().catch(() => {});
    } catch {
      // Ignore autoplay restrictions
    }
  }

  public playEnemyKilledUser(): void {
    if (this.muted || typeof Audio === 'undefined') return;
    try {
      this.stopCustomClips();
      if (!this.chachaAudio) {
        this.chachaAudio = new Audio('/assets/aistudio/chacha-ahh_6T5NLJ4B_44a6b105.mp3');
      }
      this.chachaAudio.volume = 0.9;
      this.chachaAudio.currentTime = 0;
      this.activeLongClip = this.chachaAudio;
      this.chachaAudio.play().catch(() => {});
    } catch {
      // Ignore autoplay restrictions
    }
  }

  public playGameStartMusic(): void {
    if (this.muted || typeof Audio === 'undefined') return;
    try {
      this.stopCustomClips();
      if (!this.gameStartAudio) {
        this.gameStartAudio = new Audio('/sounds/game-start.mp3');
      }
      this.gameStartAudio.volume = 0.85;
      this.gameStartAudio.currentTime = 0;
      this.activeLongClip = this.gameStartAudio;
      this.gameStartAudio.play().catch(() => {});
    } catch {
      // Ignore autoplay restrictions
    }
  }

  public playVictorySong(): void {
    if (this.muted || typeof Audio === 'undefined') return;
    try {
      this.stopCustomClips();
      if (!this.victorySongAudio) {
        this.victorySongAudio = new Audio('/sounds/win-song.mp3');
      }
      this.victorySongAudio.volume = 0.85;
      this.victorySongAudio.currentTime = 0;
      this.activeLongClip = this.victorySongAudio;
      this.victorySongAudio.play().catch(() => {});
    } catch {
      // Ignore autoplay restrictions
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(val: boolean): void {
    this.muted = val;
    if (val) {
      this.stopCustomClips();
    }
    try {
      localStorage.setItem('los_muted', val ? '1' : '0');
    } catch {
      // Ignore storage failures
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playWeaponFire(category: WeaponCategory, powered = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (category === 'close') {
      // Punchy twin-bore shotgun boom + metallic pump click
      const boom = ctx.createOscillator();
      const boomGain = ctx.createGain();
      boom.type = 'sawtooth';
      boom.frequency.setValueAtTime(powered ? 240 : 195, now);
      boom.frequency.exponentialRampToValueAtTime(48, now + 0.14);
      boomGain.gain.setValueAtTime(0.18, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      boom.connect(boomGain);
      boomGain.connect(ctx.destination);
      boom.start(now);
      boom.stop(now + 0.16);

      const crack = ctx.createOscillator();
      const crackGain = ctx.createGain();
      crack.type = 'square';
      crack.frequency.setValueAtTime(powered ? 680 : 540, now);
      crack.frequency.exponentialRampToValueAtTime(135, now + 0.06);
      crackGain.gain.setValueAtTime(0.09, now);
      crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      crack.connect(crackGain);
      crackGain.connect(ctx.destination);
      crack.start(now);
      crack.stop(now + 0.07);
      return;
    }

    if (category === 'mid') {
      // Crisp 2-pulse carbine chirp
      [0, 0.045].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        const t = now + offset;
        osc.frequency.setValueAtTime((powered ? 640 : 540) - idx * 70, t);
        osc.frequency.exponentialRampToValueAtTime(190, t + 0.055);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.065);
      });
      return;
    }

    // Long-range Horizon Lance: resonant rail discharge
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'sawtooth';
    body.frequency.setValueAtTime(powered ? 920 : 780, now);
    body.frequency.exponentialRampToValueAtTime(75, now + 0.24);
    bodyGain.gain.setValueAtTime(0.15, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    body.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    body.start(now);
    body.stop(now + 0.27);
  }

  public playUtilityDeploy(rare = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Soft pressurized canister hiss + snare chime
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(rare ? 520 : 410, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.28);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.31);
  }

  public playHit(heavy = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(heavy ? 185 : 150, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + (heavy ? 0.18 : 0.13));
    gain.gain.setValueAtTime(heavy ? 0.28 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.19 : 0.14));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);

    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = 'square';
    snap.frequency.setValueAtTime(heavy ? 620 : 480, now);
    snap.frequency.exponentialRampToValueAtTime(140, now + 0.05);
    snapGain.gain.setValueAtTime(0.08, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    snap.connect(snapGain);
    snapGain.connect(ctx.destination);
    snap.start(now);
    snap.stop(now + 0.06);
  }

  public playDash(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playCoverSnap(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.085);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playCoverBlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Crisp concrete/steel ricochet ping
    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(1280, now);
    ping.frequency.exponentialRampToValueAtTime(520, now + 0.09);
    pingGain.gain.setValueAtTime(0.11, now);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    ping.connect(pingGain);
    pingGain.connect(ctx.destination);
    ping.start(now);
    ping.stop(now + 0.11);

    // Dense masonry thud
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(140, now);
    thud.frequency.exponentialRampToValueAtTime(55, now + 0.07);
    thudGain.gain.setValueAtTime(0.15, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.085);
  }

  public playPickup(kind: PickupType, rarity: LootRarity = 'common'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Radiant ascending chime for Rare Gold loot
    const notes =
      rarity === 'rare'
        ? [587.33, 739.99, 880.0, 1174.66]
        : kind === 'medkit'
          ? [523.25, 659.25, 783.99]
          : kind === 'shield'
            ? [392.0, 523.25, 659.25]
            : kind === 'speed'
              ? [587.33, 739.99, 880.0]
              : kind === 'utility'
                ? [349.23, 440.0, 659.25]
                : [440.0, 554.37, 880.0];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = rarity === 'rare' ? 'sine' : 'triangle';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(rarity === 'rare' ? 0.16 : 0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (rarity === 'rare' ? 0.24 : 0.14));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + (rarity === 'rare' ? 0.25 : 0.15));
    });
  }

  public playStormTick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.linearRampToValueAtTime(95, now + 0.09);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playElimination(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [240, 175, 110];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + idx * 0.07;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playRoundStart(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [392.0, 523.25, 659.25];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.08;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  public playRoundEnd(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [587.33, 440.0, 523.25];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.1;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  public playCountdownTick(isGo = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (!isGo) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(493.88, now + 0.09);
      gain.gain.setValueAtTime(0.13, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
      return;
    }
    // Bold stadium FIGHT! power chord
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(idx === 0 ? 0.11 : 0.13, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    });
  }

  public playKillstreak(streak: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const baseNotes =
      streak >= 4
        ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
        : streak === 3
          ? [440.0, 554.37, 659.25, 880.0]
          : [440.0, 587.33, 739.99];
    baseNotes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.06;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playOverdriveNova(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Deep sub-bass drop
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(175, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.42);
    subGain.gain.setValueAtTime(0.32, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.46);

    // Electric plasma sweep
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(1120, now);
    sweep.frequency.exponentialRampToValueAtTime(140, now + 0.32);
    sweepGain.gain.setValueAtTime(0.14, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    sweep.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweep.start(now);
    sweep.stop(now + 0.35);
  }

  public playJumpPad(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.16);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playSupplyDrop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [659.25, 880.0, 1174.66].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.085;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  public playSuddenDeath(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [220, 185, 146.83].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + i * 0.11;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  public playCoinPickup(big = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = big ? [987.77, 1318.51, 1760.0] : [987.77, 1318.51];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.045;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(big ? 0.14 : 0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playLevelUp(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === notes.length - 1 ? 'sine' : 'triangle';
      const t = now + i * 0.075;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  public playGunUpgrade(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Tactile metallic rack click
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(320, now);
    click.frequency.exponentialRampToValueAtTime(760, now + 0.06);
    clickGain.gain.setValueAtTime(0.1, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(now);
    click.stop(now + 0.08);

    // Ascending power-core lock chord
    [440, 659.25, 880, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + 0.07 + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playVictory(): void {
    this.playVictorySong();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.09;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.46);
    });
  }
}

export const audioEngine = new GameAudioEngine();
