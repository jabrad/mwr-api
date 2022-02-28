/* eslint-disable @typescript-eslint/no-explicit-any */

type OptsType<K> = K extends (opts: infer T) => any ? T : never;

export class Middleware<C> {
  with<K extends(opts: any, context: C) => any>(cb: K)
    : Layer<OptsType<K>, C, ReturnType<K>, ReturnType<K>> {
    return new Layer(cb);
  }
}

/**
 * T - opts type;
 * C - context type;
 * R - local return type;
 * F - global return type;
 */
class Layer<T, C, R, F> {
  private errorHandler?: (error: unknown, context: C) => F;

  constructor(
    private cb: (opts: T, context: C) => R | Promise<R>,
    private readonly next?: Layer<R, C, any, any>,
  ) { }

  with<K extends(opts: any, context: C) => T | Promise<T>>(cb: K)
    : Layer<
    OptsType<K>,
    C,
    T,
    // Promisify global return type if passed callback returns a promise.
    // Global return type is not promisified if it's alread a promise.
    (ReturnType<K> extends Promise<any> ? (F extends Promise<any> ? F : Promise<F>) : F)
    > {
    return new Layer(cb, this);
  }

  invoke(opts: T, context: C): F {
    if (this.errorHandler) {
      try {
        const ownResult = this.cb(opts, context);

        let recResult: F;

        if (ownResult instanceof Promise) {
          // Promise might still reject
          if (this.next)
            recResult = ownResult.then(data => this.next!.invoke(data, context)) as any;
          else
            recResult = ownResult as any;
        }
        else {
          recResult = this.next ? this.next.invoke(ownResult, context) : ownResult;
        }

        if (recResult instanceof Promise)
          return recResult.catch(err => this.errorHandler!(err, context)) as any;
        else
          return recResult;
      }
      catch (err) {
        return this.errorHandler(err, context);
      }
    }
    else {
      const ownResult = this.cb(opts, context);

      if (this.next) {
        if (ownResult instanceof Promise)
          return ownResult.then(data => this.next!.invoke(data, context)) as any;
        else
          return this.next.invoke(ownResult, context);
      }
      else {
        return ownResult as any;
      }
    }
  }

  onError(handler: (error: unknown, context: C) => F): this {
    this.errorHandler = handler;

    return this;
  }

  done(): (opts: T, context: C) => F {
    return (opts, context) => this.invoke(opts, context);
  }
}
