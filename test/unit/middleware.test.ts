import * as sinon from 'sinon';
import { assert } from 'sinon';

import * as middleware from './middleware';


describe('middleware', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('with non-async functions', () => {
    it('should work', () => {
      const sut = new middleware.Middleware<undefined>()
        .with((num: number) => num + 1)
        .with((str: string) => Number(str))
        .with((str: string) => str + '.1')
        .with((str: string) => str)
        .done();

      const result = sut('7', undefined);

      assert.match(result, 8.1);
    });
  });

  describe('with async functions', () => {
    it('should work', async () => {
      const sut = new middleware.Middleware<undefined>()
        .with((num: number) => num + 1)
        .with((str: string) => Number(str))
        .with((str: string) => Promise.resolve(str + '.1'))
        .with((str: string) => str)
        .done();

      const result = await sut('1', undefined);

      assert.match(result, 2.1);
    });
  });

  describe('with async functions and a "catch all" error handler', () => {
    describe('with an error destined for the "catch all" error handler', () => {
      it('should be caught', async () => {
        const sut = new middleware.Middleware<undefined>()
          .with((num: number) => num + 1)
          .with((str: string) => Number(str))
          .onError(_err => 77)
          .with((str: string) => Promise.reject('some reason'))
          .with((str: string) => str)
          .onError(async _err => 10)
          .done();

        const result = await sut('5', undefined);

        assert.match(result, 10);
      });
    });

    describe('with an error destined for an upper error handler', () => {
      it('should be caught', async () => {
        const sut = new middleware.Middleware<undefined>()
          .with((num: number) => num + 1)
          .with((str: string) => Promise.reject(Number(str)))
          .onError(async _err => 77)
          .with((str: string) => Promise.resolve('4' + str))
          .with((str: string) => str)
          .onError(async _err => 10)
          .done();

        const result = await sut('0', undefined);

        assert.match(result, 77);
      });
    });
  });
});
