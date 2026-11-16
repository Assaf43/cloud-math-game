import { createRng, randInt, shuffle } from '../src/rng';

test('same seed gives same sequence', () => {
  const a = createRng(42), b = createRng(42);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});
test('randInt is inclusive and in range', () => {
  const rng = createRng(1); const seen = new Set<number>();
  for (let i = 0; i < 500; i++) seen.add(randInt(rng, 7, 10));
  expect([...seen].sort()).toEqual([10, 7, 8, 9].sort());
});
test('shuffle keeps all items and does not mutate', () => {
  const src = [1, 2, 3, 4, 5]; const out = shuffle(createRng(3), src);
  expect(src).toEqual([1, 2, 3, 4, 5]); expect([...out].sort()).toEqual(src);
});
