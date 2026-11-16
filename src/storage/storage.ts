import type { Difficulty, Grade } from '../types';

export interface Profile { name: string; age: number; grade: Grade }
export interface ScoreEntry {
  name: string; grade: Grade; difficulty: Difficulty; total: number; avg: number; problems: number; date: string;
}
type Backend = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
interface Data { profiles: Profile[]; scores: ScoreEntry[]; muted: boolean }

const KEY = 'cloud-math:v1';
const MAX_SCORES = 200;
const MAX_NAME = 20;
const GRADES = [3, 4, 5, 6];
const DIFFICULTIES = ['beginner', 'advanced', 'expert'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isProfile = (v: unknown): v is Profile =>
  isObj(v) && typeof v.name === 'string' && typeof v.age === 'number' && GRADES.includes(v.grade as number);
const isScore = (v: unknown): v is ScoreEntry =>
  isObj(v) && typeof v.name === 'string' && GRADES.includes(v.grade as number) && DIFFICULTIES.includes(v.difficulty as string) &&
  typeof v.total === 'number' && typeof v.avg === 'number' && typeof v.problems === 'number' && typeof v.date === 'string';

const cleanName = (name: string) => name.trim().slice(0, MAX_NAME);

function defaultBackend(): Backend | null {
  try { return window.localStorage ?? null; } catch { return null; }   // access itself can throw (blocked site data)
}

/** Device-only persistence. Every failure mode (no storage, corrupt data, quota) degrades to "nothing saved". */
export class Storage {
  private readonly backend: Backend | null;

  constructor(backend?: Backend | null) {
    this.backend = backend === undefined ? defaultBackend() : backend;
  }

  profiles(): Profile[] { return this.read().profiles; }

  saveProfile(p: Profile): void {
    const name = cleanName(p.name);
    if (!name) return;
    const data = this.read();
    const profile: Profile = { name, age: p.age, grade: p.grade };
    const i = data.profiles.findIndex(x => x.name === name);
    if (i >= 0) data.profiles[i] = profile; else data.profiles.push(profile);
    this.write(data);
  }

  addScore(e: ScoreEntry): { isPersonalBest: boolean } {
    if (!this.backend) return { isPersonalBest: false };        // nothing can be saved, so nothing is a saved record
    const entry: ScoreEntry = { ...e, name: cleanName(e.name) };
    const data = this.read();
    const best = this.bestOf(data.scores, entry.name, entry.grade, entry.difficulty);
    const isPersonalBest = best === null || entry.avg > best.avg;
    data.scores.push(entry);
    if (data.scores.length > MAX_SCORES) {
      // drop the lowest avg; among equals, the oldest goes first
      data.scores.sort((a, b) => b.avg - a.avg || b.date.localeCompare(a.date));
      data.scores.length = MAX_SCORES;
    }
    this.write(data);
    return { isPersonalBest };
  }

  personalBest(name: string, grade: Grade, difficulty: Difficulty): ScoreEntry | null {
    return this.bestOf(this.read().scores, cleanName(name), grade, difficulty);
  }

  topScores(): ScoreEntry[] {
    return [...this.read().scores]
      .sort((a, b) => b.avg - a.avg || b.total - a.total || b.date.localeCompare(a.date))
      .slice(0, 10);
  }

  muted(): boolean { return this.read().muted; }

  setMuted(m: boolean): void {
    const data = this.read();
    data.muted = m;
    this.write(data);
  }

  private bestOf(scores: ScoreEntry[], name: string, grade: Grade, difficulty: Difficulty): ScoreEntry | null {
    let best: ScoreEntry | null = null;
    for (const s of scores)
      if (s.name === name && s.grade === grade && s.difficulty === difficulty && (!best || s.avg > best.avg)) best = s;
    return best;
  }

  private read(): Data {
    const empty: Data = { profiles: [], scores: [], muted: false };
    if (!this.backend) return empty;
    try {
      const raw = this.backend.getItem(KEY);
      if (!raw) return empty;
      const parsed: unknown = JSON.parse(raw);
      if (!isObj(parsed)) return empty;
      return {
        profiles: Array.isArray(parsed.profiles) ? parsed.profiles.filter(isProfile) : [],
        scores: Array.isArray(parsed.scores) ? parsed.scores.filter(isScore) : [],
        muted: parsed.muted === true,
      };
    } catch {
      return empty;
    }
  }

  private write(data: Data): void {
    if (!this.backend) return;
    try { this.backend.setItem(KEY, JSON.stringify(data)); } catch { /* quota or blocked storage: nothing saved */ }
  }
}
