# חשבון בעננים (Cloud Math Game)

A browser math game for grades 3–6. A problem is shown, the possible answers sit in the sky, drifting clouds hide and
reveal them, and the child taps (or clicks) the right answer before the timer runs out. A cloud on top of an answer
blocks the tap, so only what is visible can be chosen. One attempt per problem. Hebrew, right-to-left, no server: all
player data stays in `localStorage` on the device.

## Run, test, build

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # Vitest (jsdom)
npm run typecheck
npm run build        # outputs dist/
npx vite preview     # serve the production build locally
```

Node 20 or newer.

Handy for manual QA: `http://localhost:5173/?debug=scene` shows every time of day × weather × city with live clouds
and sample answers.

## Deploy

`.github/workflows/deploy.yml` builds on every push to `main` (`npm ci && npm test && npm run build`) and publishes
`dist/` to GitHub Pages. In the repository settings set **Pages → Source: GitHub Actions**. The site is fully static
(`base: './'`), so it also works from any static host.

## Sending the game to someone

- **One file:** `npm run build:single` writes `release/cloud-math-game.html` (about 60 KB, everything inside). Send it by
  mail or WhatsApp; opening it in Chrome, Edge, Safari or Firefox, on a PC or a phone, runs the game. Scores are kept in
  that browser on that device. On some phones the file opens inside a preview: open it with the browser instead.
- **A link:** push to GitHub and the workflow above publishes the game to GitHub Pages; send the page address. On a phone
  the browser's "Add to Home Screen" gives it an icon.

## Where things are

| Area | Folder |
|---|---|
| Problem generators, one file per grade | `src/problems/grade3.ts` … `grade6.ts` |
| Exact arithmetic and answer formatting | `src/problems/rational.ts` |
| Wrong-answer (distractor) builder | `src/problems/choices.ts` |
| Game state machine and scoring | `src/game/` |
| Clouds (pure motion model) and scene drawing | `src/scene/` |
| Weather (Open-Meteo) and the ten cities | `src/weather/` |
| Device storage | `src/storage/` |
| Music and sounds (synthesized, no files) | `src/audio/` |
| Screens | `src/ui/`, routing in `src/app.ts` |

### Changing what a grade is asked

For now the game asks **whole numbers only** (sums, products, quotients, missing numbers and order-of-operations
exercises such as `6 × (2 + 3)`, plus simple percent and ratio in grade 6). Fractions and decimals are *parked*: each
grade file exports them as `parkedTopics`, still tested but not used by `generateProblem`. When the school's own material
says what to ask, move topics between `topics` and `parkedTopics` or add new ones. Shared whole-number builders
are in `src/problems/wholeNumbers.ts`.

The Ministry of Education is replacing the curriculum grade by grade, so each grade's topics live in their own file.
A file exports `topics: Record<Difficulty, TopicGenerator[]>`; a generator takes the seeded RNG and returns the problem
text, the answer and a list of that topic's common mistakes (`wrong`), which become the wrong choices. Add or edit a
generator there and run `npm test`: the shared checks verify every generated answer (an independent evaluator in
`tests/problems/evalText.ts` recomputes it), that answers are non-negative, at most two decimal places, and short enough (8 characters) to fit in an answer pill.

Curriculum sources:

- Curriculum for grades 1–6 (2006): https://meyda.education.gov.il/files/mazkirut_pedagogit/matematika/tochnyotlemud/mavo1.pdf
- New grade 3 curriculum: https://meyda.education.gov.il/files/Mazkirut_Pedagogit/math/primary-school/math2023/Newprogramgrade3.pdf
- New curriculum page (all grades): https://pop.education.gov.il/tchumey_daat/matmatika/yesodi/oraat-math/new-curriculum

## Test prep (הכנה למבחן)

A practice mode for an upcoming school test. From the setup screen, **הכנה למבחן** opens the player's packs. The child
types 3–5 exercises from the test material into a *pack* (the exercise rows use the game's own keypad, so the phone's
keyboard does not open for them; the pack's name is typed on the phone's normal keyboard), and the game generates similar problems from them and plays 10 of them in the same sky, **without a timer**. A missed
problem's kind comes back once later as a returning problem (darker clouds, worth 2 stars instead of 1). A right answer
gets a small celebration: the clouds part and a ray of sun falls on it (still, with reduced motion). At the end,
**הדרך** shows the way step by step for up to 3 missed kinds, with the typical slip when the picked answer matches one,
and offers one similar problem to try, without a score. The summary shows the stars and how many were solved.

Supported exercise forms, with whole numbers, fractions, mixed numbers and decimals in every grade. The pack's grade does
not limit the kinds of numbers; it caps how large generated whole numbers may grow (1,000 in grade 3, 10,000 in grade 4,
100,000 in grades 5–6, never below the typed numbers):

- one or more operations, with brackets: `48 × 6`, `3/4 + 1/8`, `2.5 − 0.75`, `6 × (2 + 3)`; a trailing `=`, `= ?` or
  `= ▢` (also `= ___`) may be typed and is dropped, so `48 × 6 =` is the same as `48 × 6`
- a missing number: `▢ + 27 = 63`, `48 ÷ ▢ = 6`
- expanding or reducing a fraction: `2/3 = ▢/12`
- a fraction to a decimal: `3/4 = ?`

An exercise made only of whole numbers must have a whole result, and a missing number or an expanded fraction must
come out whole: `17 ÷ 5`, `▢ × 7 = 50` and `2/3 = ▢/10` are refused with "התוצאה לא יוצאת מספר שלם, ואת זה עוד אי אפשר
לתרגל." Exercises with a fraction, mixed number or decimal (`1/2 + 1/4`, `7.5 ÷ 2.5`, `3/4 = ?`) are not affected.

For any other line the editor says calmly why it cannot be practised yet, and the rest of the pack still works.

Decisions made with the owner while building it:

- At **מתחיל** and **מתקדם** a generated problem keeps the digit counts of the typed example; **ממש מתקדם** may add a digit.
- At **מתחיל** whole numbers stay between half the typed number and the typed number (`48 × 6` gives 24…48 × 3…6).
  When that leaves fewer than 5 different problems, as for small or round examples (`2 × 3`, `7 × 10`, `▢ ÷ 3 = 4`),
  **מתחיל** draws the whole numbers like **מתקדם**: any number with the same digit count (2…9 for one digit), round
  numbers kept round. Fractions, mixed numbers and decimals keep the **מתחיל** rules.
- At **מתחיל** fraction denominators go up to at least 6: up to 6, or up to the example's largest denominator when
  that is larger (at most 12).
- The keypad has a `?` key, so a conversion such as `3/4 = ?` can be typed on a phone.

What does not change: the regular game (**התחל**) is exactly as before. It still asks whole numbers only, fractions and
decimals stay parked there (`parkedTopics`), and its timer, scoring, leaderboard and city bonus are untouched. Practice
results never enter the leaderboard; a pack keeps per-kind counts and the last stars, under the same `localStorage` key.
Leaving a practice from the pause menu records nothing. When the device cannot store a pack, the practice starts anyway
and the summary says the pack was not kept. There is no "wrong" wording, red flashing, failure sound or predicted grade.

Where the code lives:

| Area | File |
|---|---|
| Reading a typed exercise (exact arithmetic, never `eval`) | `src/prep/expr.ts` |
| Exercise kinds, their labels and the reasons a line is not supported | `src/prep/shape.ts` |
| Generating similar problems and their answer choices | `src/prep/generate.ts` |
| Typical slips and their sentences | `src/prep/slips.ts` |
| Step-by-step explanations | `src/prep/explain.ts` |
| Packs, the practice session | `src/prep/pack.ts`, `src/prep/prepSession.ts` |
| Screens | `src/ui/prepPacksScreen.ts`, `prepEditScreen.ts`, `prepKeypad.ts`, `prepEndScreens.ts`; routing in `src/app.ts` |

Every answer is computed in code; nothing is shown whose answer was not computed. In the tests, every problem of the
main generator test (`tests/prep/generate.test.ts`, 200 seeds per example and difficulty) is also checked against its
text with a separate test evaluator (`tests/problems/evalText.ts`): a plain exercise is evaluated, a missing number or
an expanded fraction gets the answer put in the box and both sides of `=` must be equal, and a conversion's fraction
must equal the answer.

- **Adding a slip:** add its id to `SlipId` and its sentence to `SLIP_TEXT` in `src/prep/slips.ts` (calm wording: "נראה
  ש…", never "טעית"), then add a `note(...)` line in `slips()` that computes the value a child would get. Values equal to
  the right answer, negative or not exact are dropped by `note`. The slip becomes a wrong choice in generated problems,
  and `הדרך` shows its sentence when the child picked it. Add a case to `tests/prep/slips.test.ts`.
- **Adding an explanation method:** write a function in `src/prep/explain.ts` that returns the steps (short LTR lines,
  at most 5) or `null` when it does not apply, and call it from `singleOperator` or `stepsFor`. Anything without a method
  falls back to one line, `exercise = answer`. `tests/prep/explain.test.ts` checks, for generated problems of every
  kind, that there are 1–5 steps, every equality is true and the last step ends with the computed answer.

## Rules worth knowing before changing things

- **Cloud fairness.** Every answer is fully exposed for at least 1 s at a time and never hidden (or partly hidden)
  for more than 3 s. `makeLane` guarantees it by construction and `tests/scene/clouds.test.ts` checks it by simulation.
  Each answer has its own lane height, so a cloud of another answer's lane can never cross it. Weather and time of day
  only change how the scene looks, never cloud speed or coverage.
- **No sound for wrong answers or timeouts.** `GameAudio` has no method for them on purpose. The music is soft: sine and
  triangle tones, a low-pass filter and a generated reverb, no square/saw waves.
- **Mental-math sized numbers.** Children answer in their heads, in about 30 seconds, by tapping one of a few answers, so
  generators keep numbers friendly (for example no 3-digit multipliers, divisors that are easy to work with, small common
  denominators). `tests/problems/difficulty.test.ts` holds the caps per grade and level; change them there on purpose.
- **Player text** (the name, a pack's name and its exercises) is only ever put on the page with `textContent`.
- **Weather** comes from Open-Meteo with no key; if the request fails or takes longer than 3 s a random weather is
  used. The credit "Weather data by Open-Meteo.com" is shown on the final screen.
