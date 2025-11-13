import {z} from "zod"
import {describe} from "./describe.ts"
import {bootstrap_few_shot} from "./optimizers/bootstrap.ts"
import {dspy} from "./mod.ts"

const sum = describe(
	{
		name: "sum",
		description: "Sum two numbers",
		input: z.object({x: z.number(), y: z.number()}),
		output: z.number(),
	},
	async ({x, y}) => x + y,
)

const FAKE_TRAINSET = [
	{input: {x: 1, y: 2}, output: {result: 3}},
	{input: {x: 3, y: 4}, output: {result: 7}},
	{input: {x: 5, y: 6}, output: {result: 11}},
]

const student = describe(
	{
		name: "student",
		description: "student",
		input: z.object({x: z.number(), y: z.number()}),
		output: z.object({result: z.number()}),
		model: "gpt-4o",
	},
	[
		async ctx => ({...ctx, messages: []}),
		dspy.chain_of_thought(),
		dspy.react({max_steps: 10, tools: [sum]}),
		async ctx => ({
			...ctx,
			output: JSON.parse(
				ctx.completion.choices[0]?.message.content ?? "{}",
			),
		}),
	],
)

const teacher = describe(
	{
		name: "teacher",
		description: "teacher",
		input: z.object({x: z.number(), y: z.number()}),
		output: z.object({result: z.number()}),
		model: "gpt-4o",
	},
	[
		async ctx => ({...ctx, messages: []}),
		dspy.chain_of_thought(),
		dspy.react({max_steps: 10, tools: [sum]}),
		async ctx => ({
			...ctx,
			output: JSON.parse(
				ctx.completion.choices[0]?.message.content ?? "{}",
			),
		}),
	],
)

const optimizer = bootstrap_few_shot<typeof student.input, typeof student.output>(
	{
		metric: async (expected, predicted) => {
			const expected_output = await expected({x: 1, y: 2})
			const predicted_output = await predicted({x: 1, y: 2})
			return expected_output.result === predicted_output.result
		},
	},
)

export const compiled_student = await student.compile(
	optimizer,
	teacher,
	FAKE_TRAINSET,
)
