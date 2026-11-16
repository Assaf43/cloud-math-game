import { cloudLefts, isFullyExposed, makeLane, slotLayout } from '../../src/scene/clouds';
import { createRng } from '../../src/rng';

test.each([4, 5, 6] as const)('fairness holds for %i slots over 60 s', count => {
  for (let seed = 0; seed < 50; seed++) {
    const rng = createRng(seed);
    for (const slot of slotLayout(count)) {
      const lane = makeLane(slot, rng);
      let run = 0, exposedRun = 0, wasExposed = isFullyExposed(lane, slot, 0), sawExposure = false, first = true;
      for (let t = 0; t <= 60000; t += 20) {
        const e = isFullyExposed(lane, slot, t);
        if (e === wasExposed) { e ? (exposedRun += 20) : (run += 20); }
        else {
          if (wasExposed && !first) expect(exposedRun).toBeGreaterThanOrEqual(1000 - 40);
          first = false; run = 0; exposedRun = 0; wasExposed = e;
        }
        if (e) sawExposure = true;
        expect(run).toBeLessThanOrEqual(3000 + 40);
      }
      expect(sawExposure).toBe(true);
    }
  }
}, 30000);

test.each([4, 5, 6] as const)('layout for %i slots is in bounds and not overlapping', count => {
  const s = slotLayout(count); expect(s).toHaveLength(count);
  for (const a of s) {
    expect(a.widthPct).toBe(24);
    expect(a.xPct).toBeGreaterThanOrEqual(2); expect(a.xPct + a.widthPct).toBeLessThanOrEqual(98);
    expect(a.yPct).toBeGreaterThanOrEqual(6); expect(a.yPct).toBeLessThanOrEqual(52);
  }
  for (const a of s) for (const b of s) if (a !== b)
    expect(Math.abs(a.yPct - b.yPct) >= 12 || Math.abs(a.xPct - b.xPct) >= 20).toBe(true);
});

test.each([4, 5, 6] as const)('every slot of %i has its own lane height, so no cloud of another lane crosses it', count => {
  const ys = slotLayout(count).map(s => s.yPct);
  expect(new Set(ys).size).toBe(count);
  const sorted = [...ys].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(9);
});

test('makeLane satisfies the fairness inequalities', () => {
  for (let seed = 0; seed < 200; seed++) {
    const rng = createRng(seed);
    for (const slot of slotLayout(6)) {
      const l = makeLane(slot, rng);
      expect((l.gapPct - slot.widthPct) / l.speedPctPerSec).toBeGreaterThanOrEqual(1.0);
      expect((l.cloudWidthPct + slot.widthPct) / l.speedPctPerSec).toBeLessThanOrEqual(3.0);
      expect(l.cloudWidthPct).toBeGreaterThanOrEqual(slot.widthPct + 4);
      expect([1, -1]).toContain(l.direction);
    }
  }
});

test('cloudLefts is periodic in time', () => {
  const lane = makeLane(slotLayout(4)[0], createRng(1));
  const period = (lane.cloudWidthPct + lane.gapPct) / lane.speedPctPerSec * 1000;
  expect(cloudLefts(lane, 500).map(x => +x.toFixed(3))).toEqual(cloudLefts(lane, 500 + period).map(x => +x.toFixed(3)));
});

test('cloudLefts only returns clouds that intersect the scene, and moves in the lane direction', () => {
  for (const direction of [1, -1] as const) {
    const lane = { cloudWidthPct: 24, gapPct: 50, speedPctPerSec: 20, phasePct: 10, direction };
    const a = cloudLefts(lane, 0), b = cloudLefts(lane, 100);
    for (const x of [...a, ...b]) { expect(x + lane.cloudWidthPct).toBeGreaterThan(0); expect(x).toBeLessThan(100); }
    const first = a.find(x => b.some(y => Math.abs(y - x - direction * 2) < 1e-9));
    expect(first).toBeDefined();
  }
});

test('a cloud sitting on the slot hides it, an empty lane does not', () => {
  const slot = { xPct: 40, yPct: 10, widthPct: 18 };
  const lane = { cloudWidthPct: 30, gapPct: 70, speedPctPerSec: 20, phasePct: 0, direction: 1 as const };
  // at t=0 the cloud spans 0..30 (clear of 40..58); after 1 s it spans 20..50 (overlaps)
  expect(isFullyExposed(lane, slot, 0)).toBe(true);
  expect(isFullyExposed(lane, slot, 1000)).toBe(false);
});
