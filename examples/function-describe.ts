import {z} from "zod"

import {describe} from "../src/describe.ts"

const add_numbers = describe(
	{
		name: "add_numbers",
		description: "Add two numbers together",
		input: z.object({
			a: z.number().describe("First addend"),
			b: z.number().describe("Second addend"),
		}),
		output: z.object({sum: z.number().describe("Sum of both numbers")}),
	},
	async ({a, b}) => {
		return {sum: a + b}
	},
)

async function main() {
	const result = await add_numbers({a: 1, b: 2})

	console.log("Input:", {a: 1, b: 2})
	console.log("Output:", result)
}

void main()
