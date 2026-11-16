/** Digit-wise sum without carrying, a common addition error. */
export function noCarryAdd(a: number, b: number): number {
  const x = String(a).padStart(String(b).length, '0'), y = String(b).padStart(x.length, '0');
  return parseInt([...x].map((c, i) => (+c + +y[i]) % 10).join(''), 10);
}
/** Digit-wise absolute difference without borrowing, a common subtraction error. */
export function noBorrowSub(a: number, b: number): number {
  const x = String(a), y = String(b).padStart(x.length, '0');
  return parseInt([...x].map((c, i) => Math.abs(+c - +y[i])).join(''), 10);
}
