/**
 * You can calculate the maximum total delay for <0, n> consecutive attempts using the
 * following formula: (2^n - 1) * base
 * You can also, for a given maximum total delay, calculate how many attempts you can make
 * using this formula: floor(log2(delay / base))
 */
export const getExpontentialBackoff = (attempts: number, base: number): number => {
  if (attempts === 0)
    return 0;

  const timeWindowUnits = 2 ** (attempts - 1);

  return (timeWindowUnits * base) * Math.random();
};
