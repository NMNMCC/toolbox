export type AnyObject = Record<string, unknown>
export type AnyFunction = (...args: any[]) => any
export type Promisable<T> = Promise<T> | T
