export function partial<T extends unknown[], U extends unknown[], R>(
  fn: (...args: [...T, ...U]) => R,
  ...args1: T
): (...args: U) => R {
  return (...args2: U) => fn(...args1, ...args2);
}
