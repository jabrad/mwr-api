export type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T;


// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

export const suppressRejection = (promise: Promise<unknown>): void => {
  promise.catch(noop);
};
