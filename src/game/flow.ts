import type { City, Problem } from '../types';
import type { ChooseResult } from './session';

/** What the game screen needs from a session: the regular game (Session) and the test practice (PrepSession) both provide it. */
export interface GameFlow {
  readonly playerName: string;
  readonly timeLimitMs: number | null;          // null: no timer
  readonly city: City;
  readonly phase: string;                        // 'problem' while a problem is open; anything else after advance() means the screen is done
  readonly problem: Problem;
  readonly introTitle: string;                   // card shown before the first problem
  readonly stubborn: boolean;                    // current problem is a returning one
  readonly celebrates: boolean;                  // play the positive animation on a correct answer
  status(): { round: string; problem: string; score: string };
  choose(answerText: string, elapsedMs: number): ChooseResult;
  timeout(): void;
  advance(): void;
}
