export type Grade = 3 | 4 | 5 | 6;
export type Difficulty = 'beginner' | 'advanced' | 'expert';
export type Rng = () => number;                      // uniform in [0, 1)
export interface Rational { n: number; d: number }   // reduced, d > 0, n >= 0
export type AnswerKind = 'int' | 'fraction' | 'decimal';
export interface Answer { value: Rational; kind: AnswerKind; text: string }
export interface Problem {
  text: string;            // e.g. "48 ÷ 6", "3/4 מתוך 20", "2/3 = ▢/12"
  topic: string;           // topic id, e.g. "g3.times-table"
  answer: Answer;
  choices: Answer[];       // shuffled, includes answer
  strictKind: boolean;     // true: typed input must be the same kind as answer
}
export interface GameConfig {
  name: string; age: number; grade: Grade; difficulty: Difficulty;
  secondsPerProblem: number; rounds: number;
}
export type WeatherState = 'clear' | 'partly' | 'cloudy' | 'rain' | 'storm' | 'haze';
export type TimeOfDay = 'morning' | 'noon' | 'sunset' | 'night';
export interface City { id: string; name: string; hint: string; lat: number; lon: number }
