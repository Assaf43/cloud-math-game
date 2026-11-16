/**
 * Synthesized sound, no audio files. The background music is a slow, soft piece in C major: warm pad chords that
 * swell and fade, a quiet bass note under each chord, and a sparse music-box melody, all through a little reverb.
 * A short bell chimes on a correct answer. There is deliberately NO sound for a wrong answer or a timeout.
 * The AudioContext is created lazily in start(), which must be called from a user gesture (the Start click).
 * If audio is unavailable, every method silently does nothing.
 */

const BEAT_SEC = 0.95;                     // about 63 beats per minute
const BAR_BEATS = 4;
const LOOKAHEAD_SEC = 3;
const TICK_MS = 500;
const MUSIC_GAIN = 0.26;
const SUCCESS_GAIN = 0.3;
const REVERB_SEC = 2.6;
const REVERB_WET = 0.38;

/** One chord per bar (Hz): a gentle I - vi - IV - V, I - iii - IV - V loop. */
const CHORDS: { pad: number[]; bass: number }[] = [
  { pad: [261.63, 329.63, 392.0, 493.88], bass: 65.41 },     // Cmaj7
  { pad: [220.0, 261.63, 329.63, 392.0], bass: 55.0 },       // Am7
  { pad: [174.61, 261.63, 329.63, 440.0], bass: 43.65 },     // Fmaj7 (no 5th)
  { pad: [196.0, 246.94, 293.66, 329.63], bass: 49.0 },      // G6
  { pad: [261.63, 329.63, 392.0, 493.88], bass: 65.41 },     // Cmaj7
  { pad: [164.81, 246.94, 329.63, 392.0], bass: 41.2 },      // Em7
  { pad: [174.61, 261.63, 329.63, 440.0], bass: 43.65 },     // Fmaj7
  { pad: [196.0, 246.94, 293.66, 329.63], bass: 49.0 },      // G6
];

/** [beat in the bar, Hz]: a few unhurried notes per bar, mostly pentatonic. */
const MELODY: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[0, 659.25], [1.5, 783.99], [3, 659.25]],
  [[0, 880.0], [2, 659.25], [3, 783.99]],
  [[0, 880.0], [1.5, 783.99], [3, 659.25]],
  [[0, 587.33], [1.5, 783.99], [3, 659.25]],
  [[0, 783.99], [1.5, 659.25], [3, 523.25]],
  [[0, 659.25], [2, 783.99], [3.5, 880.0]],
  [[0, 880.0], [1.5, 1046.5], [3, 880.0]],
  [[0, 783.99], [1.5, 587.33], [3, 493.88]],
];

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
  private music: AudioNode | null = null;      // where the music is sent (dry + reverb)
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
        this.addReverb(ctx, music, master);
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
      this.bell(this.sfx, 783.99, t, 0.9, 1);            // G5
      this.bell(this.sfx, 1174.66, t + 0.14, 1.1, 0.8);  // D6, a soft rising pair
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
  /** A generated room: decaying noise as an impulse response. Skipped quietly where it is not supported. */
  private addReverb(ctx: AudioContext, from: GainNode, to: GainNode): void {
    try {
      const length = Math.floor(ctx.sampleRate * REVERB_SEC) || 1;
      const impulse = ctx.createBuffer(2, length, ctx.sampleRate || 44100);
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6);
      }
      const convolver = ctx.createConvolver();
      convolver.buffer = impulse;
      const wet = ctx.createGain();
      wet.gain.value = REVERB_WET;
      from.connect(convolver);
      convolver.connect(wet);
      wet.connect(to);
    } catch { /* no reverb: the music is simply a little drier */ }
  }

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
        this.nextBarTime += BEAT_SEC * BAR_BEATS;
        this.bar = (this.bar + 1) % CHORDS.length;
      }
    } catch {
      this.broken = true;
      this.stopTimer();
    }
  }

  private scheduleBar(start: number, bar: number): void {
    const length = BEAT_SEC * BAR_BEATS;
    const chord = CHORDS[bar];
    // Pad: each note is a pair of slightly detuned triangles, swelling in and fading out across the bar.
    chord.pad.forEach((hz, i) => {
      this.swell(hz, start + i * 0.06, length + 1.6, 0.26, -4);
      this.swell(hz, start + i * 0.06, length + 1.6, 0.26, 4);
    });
    this.swell(chord.bass, start, length + 1.2, 0.55, 0, 'sine');
    for (const [beat, hz] of MELODY[bar]) this.bell(this.music!, hz, start + beat * BEAT_SEC, 1.8, 0.55);
  }

  /** A soft sustained tone with a slow attack and release. */
  private swell(hz: number, at: number, length: number, level: number, detuneCents: number, type: OscillatorType = 'triangle'): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = hz;
    osc.detune.value = detuneCents;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + 1.1);
    env.gain.linearRampToValueAtTime(level * 0.8, at + length - 1.4);
    env.gain.linearRampToValueAtTime(0, at + length);
    osc.connect(this.softened(env));
    env.connect(this.music!);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }

  /** A low-pass in front of a pad note takes the edge off the triangle wave. Falls back to no filter. */
  private softened(next: AudioNode): AudioNode {
    try {
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1300;
      filter.connect(next);
      return filter;
    } catch {
      return next;
    }
  }

  /** A music-box / bell note: instant attack, long smooth decay, a faint upper partial. */
  private bell(dest: AudioNode, hz: number, at: number, decay: number, level: number): void {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0008, at + decay);
    env.connect(dest);
    for (const [mult, share] of [[1, 1], [2, 0.18]] as const) {
      const osc = ctx.createOscillator();
      const part = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz * mult;
      part.gain.value = share;
      osc.connect(part);
      part.connect(env);
      osc.start(at);
      osc.stop(at + decay + 0.05);
    }
  }
}
