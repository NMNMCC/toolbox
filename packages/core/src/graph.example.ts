import * as graph from "./graph.ts"

const add = async ({a, b}: {a: number; b: number}) => a + b
const double = async (x: number) => x * 2
const combine = (number: number) =>
	graph.connect(
		{add, double},
		async ({add, double}) => add + double,
	)({add: {a: number, b: number}, double: number})

console.log(await combine(2))
