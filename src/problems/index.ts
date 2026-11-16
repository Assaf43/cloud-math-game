import type { Difficulty, Grade, Problem, Rng } from '../types';
import { pick } from '../rng';
import { buildChoices, choiceCount } from './choices';
import type { TopicTable } from './topic';
import { topics as grade3 } from './grade3';
import { topics as grade4 } from './grade4';
import { topics as grade5 } from './grade5';
import { topics as grade6 } from './grade6';

const GRADES: Record<Grade, TopicTable> = { 3: grade3, 4: grade4, 5: grade5, 6: grade6 };

export function generateProblem(grade: Grade, difficulty: Difficulty, rng: Rng): Problem {
  const gen = pick(rng, GRADES[grade][difficulty]);
  const t = gen(rng);
  return {
    text: t.text,
    topic: t.topic,
    answer: t.answer,
    choices: buildChoices(t.answer, t.wrong, choiceCount(difficulty), rng),
  };
}
