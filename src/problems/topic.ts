import type { Answer, Difficulty, Rational, Rng } from '../types';
import { intAnswer, rat } from './rational';

export interface TopicProblem {
  text: string;
  topic: string;
  answer: Answer;
  wrong: Rational[];           // common-error values for this topic
  strictKind?: boolean;
}
export type TopicGenerator = (rng: Rng) => TopicProblem;
export type TopicTable = Record<Difficulty, TopicGenerator[]>;

/** Integer-answer problem. Wrong values that are not non-negative integers are dropped. */
export function intProblem(topic: string, text: string, answer: number, wrong: number[]): TopicProblem {
  return {
    text,
    topic,
    answer: intAnswer(answer),
    wrong: wrong.filter(w => Number.isInteger(w) && w >= 0 && w !== answer).map(w => rat(w)),
  };
}
