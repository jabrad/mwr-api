export interface TestCase<T1, T2> {
  args: T1;
  expected: T2;
}


export function chainStub(lastCallName?: string, returnValue?: any) {
  const proxy = new Proxy({}, {
    get: (_target, prop) => {
      if (lastCallName !== undefined && prop === lastCallName)
        return () => returnValue;
      else
        return () => proxy;
    },
  }) as any;

  return proxy;
}


export function testCases<T1, T2>(
  cases: TestCase<T1, T2>[],
  cb: (_case: TestCase<T1, T2>) => any,
) {
  for (const _case of cases)
    cb(_case);
}
