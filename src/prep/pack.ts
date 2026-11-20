import type { Grade } from '../types';
import { analyze } from './shape';
import type { Analysis, Shape } from './shape';
import { canVary } from './generate';

export interface ShapeStats { seen: number; wrong: number; lastMissed: boolean }
export interface Pack {
  id: string; owner: string; name: string; grade: Grade; examples: string[]; createdAt: string;
  shapes: Record<string, ShapeStats>; lastStars: number | null;
}
export interface PackLine { input: string; analysis: Analysis }

export const MIN_LINES = 3;
export const MAX_LINES = 5;
export const MAX_PACK_NAME = 30;
export const MAX_PACKS_PER_OWNER = 20;

/** One entry per non-blank line; a supported shape that cannot be varied for this grade is reported as 'cannot-vary'. */
export function analyzeLines(examples: readonly string[], grade: Grade): PackLine[] {
  const lines: PackLine[] = [];
  for (const raw of examples) {
    const input = raw.trim();
    if (!input) continue;
    const a = analyze(input);
    const analysis: Analysis = a.ok && !canVary(a.shape, grade) ? { ok: false, reason: 'cannot-vary' } : a;
    lines.push({ input, analysis });
  }
  return lines;
}

/** Supported shapes only, one per shape key; the first example of a key wins. */
export function packShapes(pack: Pick<Pack, 'examples' | 'grade'>): Shape[] {
  const seen = new Map<string, Shape>();
  for (const { analysis } of analyzeLines(pack.examples, pack.grade))
    if (analysis.ok && !seen.has(analysis.shape.key)) seen.set(analysis.shape.key, analysis.shape);
  return [...seen.values()];
}

export function canSave(name: string, lines: readonly PackLine[]): boolean {
  return name.trim() !== '' && lines.length >= MIN_LINES && lines.some((l) => l.analysis.ok);
}
