import {z} from "zod"

import {describe} from "../src/describe.ts"
import {initializer} from "../src/initializers/initializer.ts"
import {logging} from "../src/middlewares/logging.ts"
import {finalizer} from "../src/finalizers/finalizer.ts"

const Summarize = describe(
	{
		name: "summarize",
		description: "Summarize text",
		input: z.object({text: z.string()}),
		output: z.object({summary: z.string()}),
		model: "gpt-4o",
	},
	[
		initializer("You are an assistant that summarizes text."),
		logging({
			log: async ({context, result, elapsed_ms}) => {
				const usage = result.history.at(-1)?.[1].at(-1)?.usage
				console.log(`${context.description.name} took ${elapsed_ms}ms`)
				console.log(`Tokens: ${usage?.total_tokens}`)
			},
		}),
		finalizer(),
	],
)

async function main() {
	const out = await Summarize({
		text: "This is an example that demonstrates logging usage.",
	})
	console.dir(out, {depth: null})
}

void main()
