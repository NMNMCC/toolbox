export type AnyObject = Record<string, unknown>
export type AnyFunction = (...args: any[]) => any
export type Promisable<T> = T | Promise<T>

export type IO<In, Out> = (input: In) => Promisable<Out>
export type Sync<In, Out> = (input: In) => Out
export type Async<In, Out> = (input: In) => Promise<Out>
export type InferIOIn<F> = F extends IO<infer In, any> ? In : never
export type InferIOOut<F> = F extends IO<any, infer Out> ? Out : never

export type Merge<X, Y> = Omit<X, keyof Y> & Y
