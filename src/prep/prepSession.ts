import type { City, Difficulty, Grade, Rng } from '../types';
import type { GameFlow } from '../game/flow';
import type { ChooseResult } from '../game/session';
import { eq } from '../problems/rational';
import { generateSimilar } from './generate';
import type { PrepProblem } from './generate';
import { analyzeLines, packShapes } from './pack';
import type { Pack } from './pack';
import type { Shape } from './shape';

export interface PrepConfig { name: string; grade: Grade; difficulty: Difficulty; pack: Pack }
export interface Miss { problem: PrepProblem; picked: string }

export const BASE_PROBLEMS = 10, TWIN_GAP = 2, MAX_REVIEW = 3;
const GENERATE_TRIES = 5;                          // generateSimilar calls per shape in each avoid mode

type PrepPhase = 'problem' | 'reveal' | 'finished';
interface Pending { shape: Shape; dueAt: number }   // dueAt: number of problems shown when the twin may appear

/** A practice for a school test: 10 problems from the pack, no timer; a missed shape comes back once as a "twin". */
export class PrepSession implements GameFlow {
  readonly config: PrepConfig;
  private readonly rng: Rng;
  private readonly _city: City;
  private readonly shapes: Shape[];
  private readonly typed = new Set<string>();      // the canonical text of every supported line of the pack
  private readonly avoid = new Set<string>();      // the typed lines and every text shown so far
  private readonly queue: Pending[] = [];          // twins waiting, oldest first

  private _phase: PrepPhase = 'problem';
  private _problem!: PrepProblem;
  private _stars = 0;
  private _asked = 0;                              // problems finished
  private shown = 0;                               // problems shown, base and twins
  private baseShown = 0;
  private _misses: Miss[] = [];
  private _results: Record<string, { seen: number; wrong: number }> = {};

  constructor(config: PrepConfig, rng: Rng, city: City) {
    this.shapes = packShapes(config.pack);
    if (this.shapes.length === 0) throw new Error('the pack has no supported exercise');
    this.config = config;
    this.rng = rng;
    this._city = city;
    for (const { analysis } of analyzeLines(config.pack.examples, config.pack.grade))
      if (analysis.ok) this.typed.add(analysis.shape.exampleText);
    for (const t of this.typed) this.avoid.add(t);
    this.showNext();
    if (this._phase === 'finished') throw new Error('the pack cannot produce a first problem');
  }

  get playerName(): string { return this.config.name; }
  get timeLimitMs(): null { return null; }
  get city(): City { return this._city; }
  get phase(): PrepPhase { return this._phase; }
  get problem(): PrepProblem { return this._problem; }
  get introTitle(): string { return this.config.pack.name; }
  get stubborn(): boolean { return this._problem.stubborn; }
  get celebrates(): boolean { return true; }
  get stars(): number { return this._stars; }
  get asked(): number { return this._asked; }
  get misses(): readonly Miss[] { return this._misses; }
  get results(): Record<string, { seen: number; wrong: number }> { return this._results; }

  status(): { round: string; problem: string; score: string } {
    return { round: this.config.pack.name, problem: `תרגיל ${this.shown}`, score: `⭐ ${this._stars}` };
  }

  choose(answerText: string, _elapsedMs: number): ChooseResult {
    this.expect('problem', 'choose');
    const p = this._problem;
    const hit = p.choices.find(c => c.text === answerText);
    if (!hit) return 'invalid';
    const correct = eq(hit.value, p.answer.value);
    const row = (this._results[p.shapeKey] ??= { seen: 0, wrong: 0 });
    row.seen++;
    this._asked++;
    if (correct) {
      this._stars += p.stubborn ? 2 : 1;
    } else {
      row.wrong++;
      this._misses.push({ problem: p, picked: hit.text });
      if (!p.stubborn) this.queueTwin(p.shapeKey);
    }
    this._phase = 'reveal';
    return correct ? 'correct' : 'wrong';
  }

  timeout(): void {
    throw new Error('a practice has no timer');
  }

  advance(): void {
    this.expect('reveal', 'advance');
    this.showNext();
  }

  /** Up to MAX_REVIEW misses, one per shape, the shape missed most often first. */
  reviewItems(): Miss[] {
    const groups = new Map<string, Miss[]>();
    for (const m of this._misses) groups.set(m.problem.shapeKey, [...(groups.get(m.problem.shapeKey) ?? []), m]);
    return [...groups.values()]
      .map((g, i) => ({ first: g[0], size: g.length, i }))
      .sort((a, b) => b.size - a.size || a.i - b.i)
      .slice(0, MAX_REVIEW)
      .map(g => g.first);
  }

  /** A fresh problem of the same shape as a missed one, for the end screen. */
  makeTwin(miss: Miss): PrepProblem {
    const shape = this.shapes.find(s => s.key === miss.problem.shapeKey);
    const fresh = shape && generateSimilar(shape, this.config.difficulty, this.config.grade, this.rng, new Set([...this.typed, miss.problem.text]));
    return fresh ?? { ...miss.problem, stubborn: false };
  }

  // ---- scheduling ----------------------------------------------------------
  private expect(phase: PrepPhase, call: string): void {
    if (this._phase !== phase) throw new Error(`${call} is not allowed in phase ${this._phase}`);
  }

  private queueTwin(shapeKey: string): void {
    const shape = this.shapes.find(s => s.key === shapeKey);
    if (shape) this.queue.push({ shape, dueAt: this.shown + TWIN_GAP });
  }

  /** The next problem is a due twin, else a base problem, else (base problems done) any twin still waiting. */
  private showNext(): void {
    for (;;) {
      const baseDone = this.baseShown >= BASE_PROBLEMS;
      const i = this.queue.findIndex(t => baseDone || t.dueAt <= this.shown);
      let next: PrepProblem | null = null;
      if (i >= 0) {
        next = this.generate([this.queue.splice(i, 1)[0].shape], true);
        if (!next) continue;                       // this twin cannot be made: drop it
      } else if (!baseDone) {
        next = this.generate(this.baseOrder(), false);
        if (!next) break;                          // no shape can produce anything: end early
        this.baseShown++;
      } else break;
      this.shown++;
      this.avoid.add(next.text);
      this._problem = next;
      this._phase = 'problem';
      return;
    }
    this._phase = 'finished';
  }

  /** All shapes in a weighted random order (weight 2 for a shape missed last time); later ones are fall-backs. */
  private baseOrder(): Shape[] {
    const left = [...this.shapes];
    const order: Shape[] = [];
    while (left.length) {
      const weights = left.map(s => (this.config.pack.shapes[s.key]?.lastMissed ? 2 : 1));
      let r = this.rng() * weights.reduce((a, b) => a + b, 0);
      let k = 0;
      while (k < left.length - 1 && r >= weights[k]) r -= weights[k++];
      order.push(left.splice(k, 1)[0]);
    }
    return order;
  }

  /**
   * First shape of `candidates` that yields a new text; once its texts run out, an old one is allowed, but never a typed
   * line or the one just shown. generateSimilar can miss on a shape that is hard to hit, so each mode gets GENERATE_TRIES calls.
   */
  private generate(candidates: Shape[], stubborn: boolean): PrepProblem | null {
    const { difficulty, grade } = this.config;
    const relaxed = new Set(this.typed);
    if (this.shown > 0) relaxed.add(this._problem.text);
    for (const shape of candidates)
      for (const avoid of [this.avoid, relaxed])
        for (let i = 0; i < GENERATE_TRIES; i++) {
          const p = generateSimilar(shape, difficulty, grade, this.rng, avoid);
          if (p) return { ...p, stubborn };
        }
    return null;
  }
}
