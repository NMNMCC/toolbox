/**
 * This module provides utilities for composing functions in a dependency graph.
 * It allows executing multiple IO functions in parallel and aggregating their results
 * to pass into a final handler.
 *
 * @module graph
 */
import type {Async, IO} from "./util.ts"

export type InferDependencyIn<D> = D extends IO<infer In, any> ? In : never
export type InferDependencyOut<D> = D extends IO<any, infer Out> ? Out : never
export type InferDependenciesIn<DS extends Record<string, IO<any, any>>> = {
	[K in keyof DS]: InferDependencyIn<DS[K]>
}
export type InferDependenciesOut<DS extends Record<string, IO<any, any>>> = {
	[K in keyof DS]: InferDependencyOut<DS[K]>
}

/**
 * Connects multiple IO functions into a single pipeline step.
 * Executes dependencies in parallel and passes their results to the handler.
 *
 * @param deps A map of named IO functions to execute.
 * @param func The handler function that processes the aggregated results.
 */
export const connect = <D extends Record<string, IO<any, any>>, O = never>(
	deps: D,
	func: (inputs: NoInfer<InferDependenciesOut<D>>) => Promise<O>,
): Async<NoInfer<InferDependenciesIn<D>>, O> => {
	const entries = Object.entries(deps) as {
		[K in keyof D]: [K, D[K]]
	}[keyof D][]

	return input => {
		return Promise.all(
			entries.map(async ([name, dep]) => [name, await dep(input[name])]),
		)
			.then(Object.fromEntries)
			.then(func)
	}
}
