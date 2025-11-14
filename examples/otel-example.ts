import {z} from "zod"

import {describe} from "../src/describe.ts"
import {initializer} from "../src/initializers/initializer.ts"
import {otel} from "../src/middlewares/otel.ts"
import {retry} from "../src/middlewares/retry.ts"
import {finalizer} from "../src/finalizers/finalizer.ts"

// Replace this with real OTEL initialization in your app.
function initializeTelemetry(): void {}

const SummarizeInput = z.object({
	text: z.string().describe("Text that should be summarized"),
	target_audience: z
		.enum(["beginner", "intermediate", "expert"])
		.default("beginner")
		.describe("Knowledge level of the audience"),
})

const SummarizeOutput = z.object({
	summary: z.string(),
	key_points: z.array(z.string()).describe("Bullet-point style key ideas"),
})

const summarize_with_otel = describe(
	{
		name: "summarize_with_otel",
		description:
			"Summarize a piece of text for a given audience, with OTEL tracing enabled.",
		input: SummarizeInput,
		output: SummarizeOutput,
		model: "gpt-4o",
	},
	[
		initializer(
			[
				"You are a helpful assistant that writes short, clear summaries.",
				"Adapt the level of detail and terminology to the target audience.",
				"Return both a short paragraph summary and a list of key bullet points.",
			].join("\n"),
		),

		otel({
			name: "toolbox-otel-example",
			span_name: context =>
				`llm.summarize:${context.description.name ?? "unknown"}`,
		}),

		retry(2),
		finalizer(),
	],
)

async function main() {
	initializeTelemetry()

	const input = {
		text: "OpenTelemetry provides a standard way to collect traces, metrics, and logs from distributed systems.",
		target_audience: "beginner" as const,
	}

	const result = await summarize_with_otel(input)

	console.log("Input:", input)
	console.log("Output:", result)
}

void main()
