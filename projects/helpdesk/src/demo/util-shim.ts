// The demo build's stand-in for Node's util (tsconfig.demo.json points the
// import here): only promisify, which the API's password helpers wrap
// crypto's scrypt with (#942).

/** A Node-style callback function as one that returns a promise. */
export function promisify<Result>(
  fn: (...args: never[]) => void
): (...args: unknown[]) => Promise<Result> {
  return (...args) =>
    new Promise((resolve, reject) => {
      (fn as (...all: unknown[]) => void)(
        ...args,
        (error: unknown, result: Result) =>
          error ? reject(error) : resolve(result)
      );
    });
}
