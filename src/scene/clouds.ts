import type { Rng } from '../types';
import { randInt } from '../rng';

/** All horizontal and vertical units are percent of the scene. */
export interface Slot { xPct: number; yPct: number; widthPct: number }        // answer position, x is the left edge
export interface Lane { cloudWidthPct: number; gapPct: number; speedPctPerSec: number; phasePct: number; direction: 1 | -1 }

export const SLOT_WIDTH_PCT = 24;
const MIN_EXPOSED_SEC = 1.0;      // an answer is fully exposed for at least this long each time
const MAX_HIDDEN_SEC = 3.0;       // and is never hidden or partly hidden for longer than this
const SKY_TOP = 6, SKY_BOTTOM = 52;
/** Alternating far-apart columns: neighbours in height are always at least 26 apart horizontally. */
const COLUMNS = [6, 66, 30, 70, 20, 56];

/**
 * One answer per height, zig-zagging across the sky. Every answer gets its own lane height so that a cloud of
 * another answer's lane can never cross it: exposure then depends on its own lane only (see `isFullyExposed`).
 */
export function slotLayout(count: 4 | 5 | 6): Slot[] {
  const step = (SKY_BOTTOM - SKY_TOP) / (count - 1);
  return Array.from({ length: count }, (_, i) => ({
    xPct: COLUMNS[i], yPct: +(SKY_TOP + step * i).toFixed(3), widthPct: SLOT_WIDTH_PCT,
  }));
}

/**
 * A lane is an endless row of identical clouds with equal gaps, drifting at constant speed. Randomness only
 * varies size, speed, gap, phase and direction; the fairness inequalities hold for every outcome:
 *   (gap - slot.width) / speed >= 1.0     fully exposed for at least 1000 ms
 *   (cloudWidth + slot.width) / speed <= 3.0   never hidden or partly hidden for more than 3000 ms
 *   cloudWidth >= slot.width + 4            a cloud can cover the whole answer
 */
export function makeLane(slot: Slot, rng: Rng): Lane {
  const w = slot.widthPct;
  const minSpeed = (2 * w + 4) / MAX_HIDDEN_SEC;                         // smallest speed for which the cloud-width window is non-empty
  const speed = minSpeed + 1 + randInt(rng, 0, 80) / 10;                  // a little faster than the minimum, up to ~ +9 %/s
  const maxCloud = Math.min(MAX_HIDDEN_SEC * speed - w, w + 14);
  const cloudWidth = w + 4 + rng() * (maxCloud - (w + 4));
  const exposedSec = MIN_EXPOSED_SEC + 0.15 + rng() * 1.1;                // 1.15 s to 2.25 s fully exposed
  const gap = w + exposedSec * speed;
  return {
    cloudWidthPct: cloudWidth,
    gapPct: gap,
    speedPctPerSec: speed,
    phasePct: rng() * (cloudWidth + gap),
    direction: rng() < 0.5 ? 1 : -1,
  };
}

/** Left edges of the clouds that intersect the scene (-cloudWidth..100) at time `tMs`. */
export function cloudLefts(lane: Lane, tMs: number): number[] {
  const period = lane.cloudWidthPct + lane.gapPct;
  const raw = (lane.phasePct + (lane.direction * lane.speedPctPerSec * tMs) / 1000) % period;
  const offset = raw < 0 ? raw + period : raw;
  const out: number[] = [];
  for (let x = offset - period * Math.ceil((offset + lane.cloudWidthPct) / period); x < 100; x += period)
    if (x + lane.cloudWidthPct > 0) out.push(x);
  return out;
}

export function isFullyExposed(lane: Lane, slot: Slot, tMs: number): boolean {
  const left = slot.xPct, right = slot.xPct + slot.widthPct;
  return cloudLefts(lane, tMs).every(x => x + lane.cloudWidthPct <= left || x >= right);
}
