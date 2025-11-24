/**
 * This module provides utilities for creating chainable function pipelines.
 * It supports two main patterns:
 * - `Simplex`: A one-way data flow pipeline where steps are executed sequentially.
 * - `Duplex`: A middleware-style pipeline where wrappers can execute logic before and after the core function.
 *
 * @module chain
 */
import type {Async, IO, Promisable} from "./util.ts"

/**
 * A chainable IO function for one-way data flow.
 *
 * ```
 * input -> pipe_n -> ... -> pipe_1 -> core -> output
 * ```
 */
export type Simplex<In, Out> = Async<In, Out> & {
	/**
	 * Prepends a processing step.
	 * @param step The function to execute before the current pipeline.
	 */
	pipe: <NewIn>(step: IO<NewIn, In>) => Simplex<NewIn, Out>
}

/**
 * Creates a Simplex pipeline.
 * @param core The core IO function.
 */
export const simplex = <In, Out>(core: IO<In, Out>): Simplex<In, Out> =>
	Object.assign(async (i: In) => core(i), {
		pipe: <NewIn>(step: IO<NewIn, NoInfer<In>>): Simplex<NewIn, Out> =>
			simplex(async input => core(await step(input))),
	})

/**
 * A chainable IO function for middleware pipelines.
 *
 * ```
 * input -> pipe_n -> ... -> core -> ... -> pipe_n -> output
 * ```
 */
export type Duplex<In, Out> = Async<In, Out> & {
	/**
	 * Wraps the pipeline with a middleware.
	 * @param middleware The middleware to execute around the current pipeline.
	 */
	pipe: {
		<NewIn = In, NewOut = Out>(
			middleware: Middleware<NewIn, NewOut, In, Out>,
		): Duplex<NewIn, NewOut>
	}
}

/**
 * A middleware function that wraps execution.
 */
export type Middleware<In, Out, NextIn = In, NextOut = Out> = (
	input: In,
	next: IO<NextIn, NextOut>,
) => Promisable<Out>

export type InferMiddlewareIn<M> =
	M extends Middleware<infer In, any, any, any> ? In : never
export type InferMiddlewareOut<M> =
	M extends Middleware<any, infer Out, any, any> ? Out : never
export type InferMiddleNextIn<M> =
	M extends Middleware<any, any, infer NextIn, any> ? NextIn : never
export type InferMiddleNextOut<M> =
	M extends Middleware<any, any, any, infer NextOut> ? NextOut : never

/**
 * Creates a Duplex pipeline.
 * @param core The core IO function.
 * @param middlewares Optional initial middlewares (LIFO).
 */
export const duplex = <In, Out>(
	core: IO<In, Out>,
	...middlewares: NoInfer<Middleware<In, Out>[]>
): Duplex<In, Out> => {
	const pipeline = middlewares.reduce<IO<In, Out>>(
		(prev, curr) => input => curr(input, prev),
		core,
	)

	return Object.assign(async (i: In) => pipeline(i), {
		pipe: <NewIn = In, NewOut = Out>(
			middleware: Middleware<NewIn, NewOut, In, Out>,
		): Duplex<NewIn, NewOut> =>
			duplex(input => middleware(input, pipeline)),
	})
}
