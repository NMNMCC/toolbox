import {z} from "zod"

import {describe} from "../src/describe.ts"
import {initializer} from "../src/initializers/initializer.ts"
import {cache} from "../src/middlewares/cache.ts"
import {logging} from "../src/middlewares/logging.ts"
import {retry} from "../src/middlewares/retry.ts"
import {finalizer} from "../src/finalizers/finalizer.ts"

const SummarizeInput = z.object({
	text: z.string().describe("Text to summarize"),
	style: z
		.enum(["bullet_points", "paragraph"])
		.default("paragraph")
		.describe("Summary style"),
})

const SummarizeOutput = z.object({summary: z.string()})

const cache_store = new Map<string, any>()

const store = {
	get(key: string) {
		return cache_store.get(key)
	},
	set(key: string, value: any) {
		cache_store.set(key, value)
	},
}

const cached_summarize = describe(
	{
		name: "cached_summarize",
		description:
			"Summarize text, caching results so repeated calls with the same input reuse the previous completion.",
		input: SummarizeInput,
		output: SummarizeOutput,
		model: "gpt-4o",
	},
	[
		initializer(
			[
				"You are a summarization assistant.",
				"If style is 'bullet_points', respond as a short list.",
				"Otherwise respond as a compact paragraph.",
			].join("\n"),
		),
		cache({store}),
		logging(),
		retry(1),
		finalizer(),
	],
)

async function main() {
	const input = {
		text: "Tooling can help structure LLM calls with clear input/output schemas and middlewares.",
		style: "paragraph" as const,
	}

	const first = await cached_summarize(input)
	const second = await cached_summarize(input)

	console.log("First call:", first)
	console.log("Second call (cached):", second)
	console.log("Cache size:", cache_store.size)
}

void main()
