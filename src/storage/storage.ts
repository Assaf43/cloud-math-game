import type { Difficulty, Grade } from '../types';
import { MAX_INPUT } from '../prep/expr';
import { MAX_LINES, MAX_PACK_NAME, MAX_PACKS_PER_OWNER } from '../prep/pack';
import type { Pack } from '../prep/pack';

export interface Profile { name: string; age: number; grade: Grade }
export interface ScoreEntry {
  name: string; grade: Grade; difficulty: Difficulty; total: number; avg: number; problems: number; date: string;
}
type Backend = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
interface Data { profiles: Profile[]; scores: ScoreEntry[]; muted: boolean; packs: Pack[] }

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

const isStats = (v: unknown) =>
  isObj(v) && typeof v.seen === 'number' && typeof v.wrong === 'number' && typeof v.lastMissed === 'boolean';
const isPack = (v: unknown): v is Pack =>
  isObj(v) && typeof v.id === 'string' && typeof v.owner === 'string' && typeof v.name === 'string' &&
  typeof v.createdAt === 'string' && GRADES.includes(v.grade as number) &&
  Array.isArray(v.examples) && v.examples.every(e => typeof e === 'string') &&
  isObj(v.shapes) && Object.values(v.shapes).every(isStats) &&
  (v.lastStars === null || typeof v.lastStars === 'number');

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
    const written = this.write(data);
    return { isPersonalBest: isPersonalBest && written };       // a record that was not stored is not a record
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

  /** The owner's packs, newest first. */
  packs(owner: string): Pack[] {
    const name = cleanName(owner);
    const mine = this.read().packs.filter(p => p.owner === name);
    return mine.map((p, i) => ({ p, i }))
      .sort((a, b) => b.p.createdAt.localeCompare(a.p.createdAt) || b.i - a.i)   // equal times: the later-saved first
      .map(x => x.p);
  }

  /** Insert or replace by id. False when nothing was written or the owner already has the maximum of other packs. */
  savePack(p: Pack): boolean {
    const owner = cleanName(p.owner);
    if (!owner) return false;
    const pack: Pack = {
      ...p, owner, name: p.name.trim().slice(0, MAX_PACK_NAME),
      examples: p.examples.map(e => e.trim()).filter(Boolean).map(e => e.slice(0, MAX_INPUT)).slice(0, MAX_LINES),
    };
    const data = this.read();
    if (data.packs.filter(x => x.owner === owner && x.id !== pack.id).length >= MAX_PACKS_PER_OWNER) return false;
    const i = data.packs.findIndex(x => x.id === pack.id);
    if (i >= 0) data.packs.splice(i, 1);          // a replaced pack moves to the end: it is the latest save
    data.packs.push(pack);
    return this.write(data);
  }

  deletePack(id: string): void {
    const data = this.read();
    if (!data.packs.some(p => p.id === id)) return;
    data.packs = data.packs.filter(p => p.id !== id);
    this.write(data);
  }

  recordPractice(id: string, results: Record<string, { seen: number; wrong: number }>, stars: number): void {
    const data = this.read();
    const pack = data.packs.find(p => p.id === id);
    if (!pack) return;
    for (const [key, r] of Object.entries(results)) {
      const s = pack.shapes[key] ?? { seen: 0, wrong: 0, lastMissed: false };
      pack.shapes[key] = { seen: s.seen + r.seen, wrong: s.wrong + r.wrong, lastMissed: r.wrong > 0 };
    }
    pack.lastStars = stars;
    this.write(data);
  }

  private bestOf(scores: ScoreEntry[], name: string, grade: Grade, difficulty: Difficulty): ScoreEntry | null {
    let best: ScoreEntry | null = null;
    for (const s of scores)
      if (s.name === name && s.grade === grade && s.difficulty === difficulty && (!best || s.avg > best.avg)) best = s;
    return best;
  }

  private read(): Data {
    const empty: Data = { profiles: [], scores: [], muted: false, packs: [] };
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
        packs: Array.isArray(parsed.packs) ? parsed.packs.filter(isPack) : [],
      };
    } catch {
      return empty;
    }
  }

  private write(data: Data): boolean {
    if (!this.backend) return false;
    try { this.backend.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }   // quota or blocked storage: nothing saved
  }
}
