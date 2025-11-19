import type {Promisable} from "./util.ts"

export type Node<I extends any[], O> = (...inputs: I) => Promisable<O>
export type DependencyIn<D extends Node<any, any>[]> = {
	[K in keyof D]: D[K] extends Node<infer In, any> ? In : never
}
export type DependencyOut<D extends Node<any, any>[]> = {
	[K in keyof D]: D[K] extends Node<any, infer Out> ? Out : never
}

export const chain =
	<const D extends Node<any, any>[], O>(
		dependencies: D,
		func: Node<DependencyOut<D>, O>,
	): Node<DependencyIn<D>, O> =>
	(...inputs) => {
		const results = dependencies.map((dep, i) => dep(...inputs[i]))

		if (results.some(res => res instanceof Promise)) {
			return Promise.all(results).then(resolved =>
				func(...(resolved as DependencyOut<D>)),
			)
		}

		return func(...(results as DependencyOut<D>))
	}

if (import.meta.main) {
	const add = (a: number, b: number) => a + b
	const multiply = (x: number) => x * 3
	const combine = chain([add, multiply], (sum, product) => sum + product)

	console.log(combine([2, 3], [4]))
}
