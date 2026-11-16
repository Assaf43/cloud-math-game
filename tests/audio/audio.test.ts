import { GameAudio } from '../../src/audio/audio';

class FakeParam {
  value = 0;
  setValueAtTime(v: number) { this.value = v; }
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
  cancelScheduledValues() {}
}
class FakeNode { connect(n: unknown) { return n; } disconnect() {} }
class FakeOsc extends FakeNode { type = 'sine'; frequency = new FakeParam(); detune = new FakeParam(); started = false; start() { this.started = true; } stop() {} }
class FakeGain extends FakeNode { gain = new FakeParam(); }
class FakeFilter extends FakeNode { type = 'lowpass'; frequency = new FakeParam(); }
class FakeConvolver extends FakeNode { buffer: unknown = null; }
class FakeCtx {
  oscillators: FakeOsc[] = []; gains: FakeGain[] = []; filters: FakeFilter[] = []; convolvers: FakeConvolver[] = [];
  sampleRate = 8000; currentTime = 0; state = 'running'; destination = new FakeNode();
  resumed = 0; suspended = 0;
  createOscillator() { const o = new FakeOsc(); this.oscillators.push(o); return o; }
  createGain() { const g = new FakeGain(); this.gains.push(g); return g; }
  createBiquadFilter() { const f = new FakeFilter(); this.filters.push(f); return f; }
  createConvolver() { const c = new FakeConvolver(); this.convolvers.push(c); return c; }
  createBuffer(_ch: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  resume() { this.resumed++; this.state = 'running'; return Promise.resolve(); }
  suspend() { this.suspended++; this.state = 'suspended'; return Promise.resolve(); }
}
const make = (muted = false) => {
  const ctx = new FakeCtx(); let created = 0;
  const audio = new GameAudio(muted, () => { created++; return ctx as unknown as AudioContext; });
  return { ctx, audio, created: () => created };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('nothing is created until start() is called from a gesture', () => {
  const { ctx, audio, created } = make();
  audio.playSuccess(); audio.pauseMusic(); audio.resumeMusic();
  expect(created()).toBe(0); expect(ctx.oscillators).toHaveLength(0);
});

test('start creates one context (idempotent) and schedules music', () => {
  const { ctx, audio, created } = make();
  audio.start(); audio.start();
  expect(created()).toBe(1);
  expect(ctx.oscillators.length).toBeGreaterThan(0);
  expect(ctx.oscillators.every(o => o.started)).toBe(true);
});

test('music keeps being scheduled while time advances', () => {
  const { ctx, audio } = make();
  audio.start();
  const first = ctx.oscillators.length;
  ctx.currentTime = 20; vi.advanceTimersByTime(5000);
  expect(ctx.oscillators.length).toBeGreaterThan(first);
});

test('playSuccess adds a short two-note chime after start', () => {
  const { ctx, audio } = make();
  audio.start();
  const before = ctx.oscillators.length;
  audio.playSuccess();
  expect(ctx.oscillators.length - before).toBeGreaterThanOrEqual(2);
});

test('muted: master gain is 0, no success sound, unmuting restores it', () => {
  const { ctx, audio } = make(true);
  audio.start();
  expect(ctx.gains[0].gain.value).toBe(0);
  const before = ctx.oscillators.length;
  audio.playSuccess();
  expect(ctx.oscillators.length).toBe(before);
  expect(audio.muted).toBe(true);
  audio.setMuted(false);
  expect(ctx.gains[0].gain.value).toBeGreaterThan(0); expect(audio.muted).toBe(false);
  audio.setMuted(true);
  expect(ctx.gains[0].gain.value).toBe(0);
});

test('setMuted before start is remembered', () => {
  const { ctx, audio } = make(false);
  audio.setMuted(true); audio.start();
  expect(ctx.gains[0].gain.value).toBe(0);
});

test('pause and resume suspend and resume the context and the music timer', () => {
  const { ctx, audio } = make();
  audio.start();
  audio.pauseMusic();
  expect(ctx.suspended).toBe(1);
  const n = ctx.oscillators.length;
  ctx.currentTime = 50; vi.advanceTimersByTime(5000);
  expect(ctx.oscillators.length).toBe(n);                 // timer stopped while paused
  audio.resumeMusic();
  expect(ctx.resumed).toBeGreaterThanOrEqual(1);
  ctx.currentTime = 60; vi.advanceTimersByTime(5000);
  expect(ctx.oscillators.length).toBeGreaterThan(n);
});

test('a throwing factory makes every method a silent no-op', () => {
  const audio = new GameAudio(false, () => { throw new Error('no audio'); });
  expect(() => { audio.start(); audio.playSuccess(); audio.pauseMusic(); audio.resumeMusic(); audio.setMuted(true); }).not.toThrow();
  expect(audio.muted).toBe(true);
});

test('there is deliberately no failure sound', () => {
  for (const name of ['playFail', 'playWrong', 'playTimeout', 'playError'])
    expect(name in GameAudio.prototype).toBe(false);
  expect(Object.getOwnPropertyNames(GameAudio.prototype).filter(n => /fail|wrong|timeout|error/i.test(n))).toEqual([]);
});

test('without AudioContext in the environment the default factory is a no-op', () => {
  const audio = new GameAudio(false);
  expect(() => { audio.start(); audio.playSuccess(); }).not.toThrow();
});

test('start() after pauseMusic() brings the music back', () => {
  const { ctx, audio } = make();
  audio.start(); audio.pauseMusic();
  const n = ctx.oscillators.length;
  ctx.currentTime = 100; audio.start();
  expect(ctx.oscillators.length).toBeGreaterThan(n);
});

test('the music is soft: only sine and triangle tones, through a low-pass filter and a reverb', () => {
  const { ctx, audio } = make();
  audio.start();
  expect(ctx.oscillators.length).toBeGreaterThan(10);
  expect(new Set(ctx.oscillators.map(o => o.type))).toEqual(new Set(['sine', 'triangle']));   // no square/sawtooth chiptune
  expect(ctx.filters.length).toBeGreaterThan(0);
  expect(ctx.filters.every(f => f.frequency.value <= 2000)).toBe(true);
  expect(ctx.convolvers).toHaveLength(1);
  expect(ctx.convolvers[0].buffer).not.toBeNull();
});

test('the music is slow: bars last several seconds, so notes are never rushed', () => {
  const { ctx, audio } = make();
  audio.start();
  ctx.currentTime = 0; vi.advanceTimersByTime(60000);
  const first = ctx.oscillators.length;
  ctx.currentTime = 8; vi.advanceTimersByTime(500);
  expect(ctx.oscillators.length).toBeGreaterThan(first - 1);
});

test('still plays without reverb or filter support (older browsers)', () => {
  const ctx = new FakeCtx();
  (ctx as unknown as Record<string, unknown>).createConvolver = undefined;
  (ctx as unknown as Record<string, unknown>).createBiquadFilter = undefined;
  const audio = new GameAudio(false, () => ctx as unknown as AudioContext);
  audio.start();
  expect(ctx.oscillators.length).toBeGreaterThan(0);
  audio.playSuccess();
});
