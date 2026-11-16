/**
 * Synthesized sound, no audio files. Background music is a gentle looping melody (C major pentatonic);
 * a short chime plays on a correct answer. There is deliberately NO sound for a wrong answer or a timeout.
 * The AudioContext is created lazily in start(), which must be called from a user gesture (the Start click).
 * If audio is unavailable, every method silently does nothing.
 */

const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];   // C D E G A C D E
const MELODY: number[][] = [
  [0, 2, 4, 2], [1, 3, 4, 3], [2, 4, 5, 4], [3, 2, 1, 0],
  [0, 2, 4, 5], [4, 3, 2, 3], [1, 2, 3, 1], [0, -1, 0, -1],                    // -1 = rest
];
const BASS = [130.81, 98.0, 110.0, 130.81, 130.81, 98.0, 110.0, 130.81];
const BEAT_SEC = 0.6;
const LOOKAHEAD_SEC = 2;
const TICK_MS = 500;
const MUSIC_GAIN = 0.15;
const SUCCESS_GAIN = 0.3;

const defaultFactory = (): AudioContext => {
  const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext });
  const C = Ctor.AudioContext ?? Ctor.webkitAudioContext;
  return new C!();
};

export class GameAudio {
  private _muted: boolean;
  private readonly factory: () => AudioContext;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBarTime = 0;
  private bar = 0;
  private broken = false;

  constructor(muted: boolean, ctxFactory: () => AudioContext = defaultFactory) {
    this._muted = muted;
    this.factory = ctxFactory;
  }

  get muted(): boolean { return this._muted; }

  start(): void {
    if (this.broken) return;
    try {
      if (!this.ctx) {
        const ctx = this.factory();
        const master = ctx.createGain();            // created first: this is the master volume
        master.gain.value = this._muted ? 0 : 1;
        master.connect(ctx.destination);
        const music = ctx.createGain();
        music.gain.value = MUSIC_GAIN;
        music.connect(master);
        const sfx = ctx.createGain();
        sfx.gain.value = SUCCESS_GAIN;
        sfx.connect(master);
        this.ctx = ctx; this.master = master; this.music = music; this.sfx = sfx;
        this.nextBarTime = ctx.currentTime + 0.1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.nextBarTime = Math.max(this.nextBarTime, this.ctx.currentTime + 0.1);
      this.startTimer();                // no-op while already running; restarts music after pauseMusic()
    } catch {
      this.broken = true;
      this.ctx = null;
    }
  }

  playSuccess(): void {
    if (!this.ctx || !this.sfx || this._muted || this.broken) return;
    try {
      const t = this.ctx.currentTime;
      this.tone(this.sfx, 659.25, t, 0.14, 'sine');        // E5
      this.tone(this.sfx, 987.77, t + 0.13, 0.2, 'sine');  // B5, rising
    } catch { this.broken = true; }
  }

  pauseMusic(): void {
    if (!this.ctx || this.broken) return;
    this.stopTimer();
    try { void this.ctx.suspend(); } catch { /* ignore */ }
  }

  resumeMusic(): void {
    if (!this.ctx || this.broken) return;
    try {
      void this.ctx.resume();
      this.nextBarTime = Math.max(this.nextBarTime, this.ctx.currentTime + 0.1);
      this.startTimer();
    } catch { this.broken = true; }
  }

  setMuted(m: boolean): void {
    this._muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }

  // ---- internals ----------------------------------------------------------
  private startTimer(): void {
    if (this.timer !== null) return;
    this.scheduleAhead();
    this.timer = setInterval(() => this.scheduleAhead(), TICK_MS);
  }

  private stopTimer(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private scheduleAhead(): void {
    const ctx = this.ctx;
    if (!ctx || !this.music) return;
    try {
      while (this.nextBarTime < ctx.currentTime + LOOKAHEAD_SEC) {
        this.scheduleBar(this.nextBarTime, this.bar);
        this.nextBarTime += BEAT_SEC * 4;
        this.bar = (this.bar + 1) % MELODY.length;
      }
    } catch {
      this.broken = true;
      this.stopTimer();
    }
  }

  private scheduleBar(start: number, bar: number): void {
    MELODY[bar].forEach((n, i) => {
      if (n >= 0) this.tone(this.music!, SCALE[n], start + i * BEAT_SEC, BEAT_SEC * 0.9, 'triangle');
    });
    this.tone(this.music!, BASS[bar], start, BEAT_SEC * 3.6, 'sine', 0.6);
  }

  private tone(dest: GainNode, hz: number, at: number, length: number, type: OscillatorType, level = 1): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = hz;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + 0.03);
    env.gain.linearRampToValueAtTime(0, at + length);
    osc.connect(env);
    env.connect(dest);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
}
