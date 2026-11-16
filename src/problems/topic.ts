import type { Answer, Difficulty, Rational, Rng } from '../types';
import { decimalAnswer, fractionAnswer, intAnswer, rat } from './rational';

export interface TopicProblem {
  text: string;
  topic: string;
  answer: Answer;
  wrong: Rational[];           // common-error values for this topic
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

/** Problem whose answer is a reduced fraction / mixed number (whole results become `int`). */
export function fracProblem(topic: string, text: string, value: Rational, wrong: Rational[]): TopicProblem {
  return { text, topic, answer: fractionAnswer(value), wrong: wrong.filter(w => w.n >= 0) };
}

/** Problem whose answer is a decimal given in hundredths. Wrong values are hundredths too (non-integers and negatives are dropped). */
export function decProblem(topic: string, text: string, hundredths: number, wrongHundredths: number[]): TopicProblem {
  return {
    text,
    topic,
    answer: decimalAnswer(rat(hundredths, 100)),
    wrong: wrongHundredths.filter(w => Number.isInteger(w) && w >= 0).map(w => rat(w, 100)),
  };
}
