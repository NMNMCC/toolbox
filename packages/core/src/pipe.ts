import type {Promisable} from "./util.ts"

export type Middleware<In, Out> = (
	input: In,
	next: Next<In, Out>,
) => Promisable<Out>

export type Next<In, Out> = (input: In) => Promisable<Out>

export const pipe = <In, Out>(
	next: Next<In, Out>,
	...middlewares: Middleware<In, Out>[]
): Next<In, Out> => {
	return middlewares.reduceRight<Next<In, Out>>(
		(prev, curr) => input => curr(input, prev),
		next,
	)
}

if (import.meta.main) {
	const wrapper: Middleware<string, string> = (input, next) =>
		next(`[[${input}]]`)

	const echo = pipe(
		(input: string) => input,
		wrapper,
		wrapper,
		(input, next) => next(`Echo: ${input}`),
	)

	console.log(await echo("Hello,World!"))
}
