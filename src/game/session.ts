import type { City, GameConfig, Problem, Rng } from '../types';
import { randInt, shuffle } from '../rng';
import { generateProblem } from '../problems';
import { eq, parseInput } from '../problems/rational';
import { CITY_BONUS, problemPoints } from './scoring';

export type Phase = 'problem' | 'reveal' | 'roundSummary' | 'cityBonus' | 'finished';
export type SubmitResult = 'invalid' | 'correct' | 'wrong';
export interface RoundStats {
  correct: number;
  total: number;
  avgAnswerMs: number;
  points: number;
  cityCorrect: boolean | null;
}

export class Session {
  readonly config: GameConfig;
  private readonly rng: Rng;
  private readonly roundCities: City[];
  private readonly allCities: readonly City[];

  private _phase: Phase = 'problem';
  private _roundIndex = 0;
  private _problemIndex = 0;
  private _problemsInRound = 0;
  private _problem!: Problem;
  private _cityOptions: City[] = [];
  private _lastResult: 'correct' | 'wrong' | 'timeout' | null = null;
  private _rounds: RoundStats[] = [];
  private _mathPoints = 0;
  private _cityPoints = 0;
  private _answered = 0;                 // problems finished so far, over the whole game

  // running figures for the round in progress
  private roundCorrect = 0;
  private roundPoints = 0;
  private roundMs = 0;

  constructor(config: GameConfig, rng: Rng, cities: readonly City[]) {
    if (cities.length < Math.max(4, config.rounds)) throw new Error('not enough cities');
    this.config = config;
    this.rng = rng;
    this.allCities = cities;
    this.roundCities = shuffle(rng, cities).slice(0, config.rounds);
    this.startRound();
  }

  get phase(): Phase { return this._phase; }
  get roundIndex(): number { return this._roundIndex; }
  get problemIndex(): number { return this._problemIndex; }
  get problemsInRound(): number { return this._problemsInRound; }
  get problem(): Problem { return this._problem; }
  get city(): City { return this.roundCities[this._roundIndex]; }
  get cityOptions(): City[] { return [...this._cityOptions]; }
  get lastResult(): 'correct' | 'wrong' | 'timeout' | null { return this._lastResult; }
  get rounds(): readonly RoundStats[] { return this._rounds; }
  get totalScore(): number { return this._mathPoints + this._cityPoints; }
  get avgPointsPerProblem(): number {
    return this._answered === 0 ? 0 : Math.round(this._mathPoints / this._answered);
  }

  submit(input: string, elapsedMs: number): SubmitResult {
    this.expect('problem', 'submit');
    const parsed = parseInput(input);
    if (!parsed) return 'invalid';
    const p = this._problem;
    // A typed value must equal one of the on-screen choices. With strictKind a decimal choice
    // cannot be answered with a fraction (and vice versa for the other kinds).
    const hit = p.choices.find(c => eq(c.value, parsed.value) && (!p.strictKind || c.kind === parsed.kind || (c.kind === 'decimal' && parsed.kind === 'int')));
    if (!hit) return 'invalid';
    const limitMs = this.config.secondsPerProblem * 1000;
    const correct = eq(hit.value, p.answer.value);
    this.finishProblem(correct ? 'correct' : 'wrong', Math.min(Math.max(elapsedMs, 0), limitMs));
    if (correct) this.addPoints(problemPoints(elapsedMs, limitMs));
    return correct ? 'correct' : 'wrong';
  }

  timeout(): void {
    this.expect('problem', 'timeout');
    this.finishProblem('timeout', this.config.secondsPerProblem * 1000);
  }

  advance(): void {
    switch (this._phase) {
      case 'reveal':
        if (this._problemIndex + 1 < this._problemsInRound) {
          this._problemIndex++;
          this.nextProblem();
        } else {
          this._rounds.push({
            correct: this.roundCorrect,
            total: this._problemsInRound,
            avgAnswerMs: Math.round(this.roundMs / this._problemsInRound),
            points: this.roundPoints,
            cityCorrect: null,
          });
          this._phase = 'roundSummary';
        }
        return;
      case 'roundSummary':
        this._phase = 'cityBonus';
        return;
      case 'cityBonus':
        if (this._rounds[this._roundIndex].cityCorrect === null) throw new Error('answer the city question first');
        if (this._roundIndex + 1 < this.config.rounds) {
          this._roundIndex++;
          this.startRound();
        } else {
          this._phase = 'finished';
        }
        return;
      default:
        throw new Error(`advance is not allowed in phase ${this._phase}`);
    }
  }

  answerCity(cityId: string): boolean {
    this.expect('cityBonus', 'answerCity');
    const stats = this._rounds[this._roundIndex];
    if (stats.cityCorrect !== null) throw new Error('city question already answered');
    const correct = cityId === this.city.id;
    stats.cityCorrect = correct;
    if (correct) this._cityPoints += CITY_BONUS;
    return correct;
  }

  // ---- internals -----------------------------------------------------------
  private expect(phase: Phase, call: string): void {
    if (this._phase !== phase) throw new Error(`${call} is not allowed in phase ${this._phase}`);
  }

  private startRound(): void {
    this._problemsInRound = randInt(this.rng, 7, 10);
    this._problemIndex = 0;
    this.roundCorrect = 0;
    this.roundPoints = 0;
    this.roundMs = 0;
    const others = shuffle(this.rng, this.allCities.filter(c => c.id !== this.city.id)).slice(0, 3);
    this._cityOptions = shuffle(this.rng, [this.city, ...others]);
    this.nextProblem();
  }

  private nextProblem(): void {
    this._problem = generateProblem(this.config.grade, this.config.difficulty, this.rng);
    this._lastResult = null;
    this._phase = 'problem';
  }

  private finishProblem(result: 'correct' | 'wrong' | 'timeout', answerMs: number): void {
    this._lastResult = result;
    this._answered++;
    this.roundMs += answerMs;
    if (result === 'correct') this.roundCorrect++;
    this._phase = 'reveal';
  }

  private addPoints(points: number): void {
    this.roundPoints += points;
    this._mathPoints += points;
  }
}
