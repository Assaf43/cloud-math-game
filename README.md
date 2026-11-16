# חשבון בעננים (Cloud Math Game)

A browser math game for grades 3–6. A problem is shown, the possible answers sit in the sky, drifting clouds hide and
reveal them, and the child types the right answer before the timer runs out. Hebrew, right-to-left, no server: all
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

## Where things are

| Area | Folder |
|---|---|
| Problem generators, one file per grade | `src/problems/grade3.ts` … `grade6.ts` |
| Exact arithmetic, answer formatting, typed-input parsing | `src/problems/rational.ts` |
| Wrong-answer (distractor) builder | `src/problems/choices.ts` |
| Game state machine and scoring | `src/game/` |
| Clouds (pure motion model) and scene drawing | `src/scene/` |
| Weather (Open-Meteo) and the ten cities | `src/weather/` |
| Device storage | `src/storage/` |
| Music and sounds (synthesized, no files) | `src/audio/` |
| Screens | `src/ui/`, routing in `src/app.ts` |

### Changing what a grade is asked

The Ministry of Education is replacing the curriculum grade by grade, so each grade's topics live in their own file.
A file exports `topics: Record<Difficulty, TopicGenerator[]>`; a generator takes the seeded RNG and returns the problem
text, the answer and a list of that topic's common mistakes (`wrong`), which become the wrong choices. Add or edit a
generator there and run `npm test`: the shared checks verify every generated answer (an independent evaluator in
`tests/problems/evalText.ts` recomputes it), that answers are non-negative, at most two decimal places, and typeable in
8 characters.

Curriculum sources:

- Curriculum for grades 1–6 (2006): https://meyda.education.gov.il/files/mazkirut_pedagogit/matematika/tochnyotlemud/mavo1.pdf
- New grade 3 curriculum: https://meyda.education.gov.il/files/Mazkirut_Pedagogit/math/primary-school/math2023/Newprogramgrade3.pdf
- New curriculum page (all grades): https://pop.education.gov.il/tchumey_daat/matmatika/yesodi/oraat-math/new-curriculum

## Rules worth knowing before changing things

- **Cloud fairness.** Every answer is fully exposed for at least 1 s at a time and never hidden (or partly hidden)
  for more than 3 s. `makeLane` guarantees it by construction and `tests/scene/clouds.test.ts` checks it by simulation.
  Each answer has its own lane height, so a cloud of another answer's lane can never cross it. Weather and time of day
  only change how the scene looks, never cloud speed or coverage.
- **No sound for wrong answers or timeouts.** `GameAudio` has no method for them on purpose.
- **Player text** (the name) is only ever put on the page with `textContent`.
- **Weather** comes from Open-Meteo with no key; if the request fails or takes longer than 3 s a random weather is
  used. The credit "Weather data by Open-Meteo.com" is shown on the final screen.
