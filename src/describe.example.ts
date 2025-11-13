import {z} from "zod"
import {describe} from "./describe.ts"
import {react} from "./middlewares/react.ts"

const sum = describe(
	{
		name: "sum",
		description: "Sum two numbers",
		input: z.object({x: z.number(), y: z.number()}),
		output: z.number(),
	},
	async ({x, y}) => x + y,
)

// @ts-expect-error - This is an example
const vibesum = describe(
	{
		name: "example",
		description: "example",
		input: z.object({x: z.number(), y: z.number()}),
		output: z.object({result: z.number()}),
		model: "gpt-4o",
	},
	[
		async ctx => ({...ctx, messages: []}),
		async (ctx, next) => await next(ctx),
		react({max_steps: 10, tools: [sum]}),
		async ctx => ({
			...ctx,
			output: JSON.parse(
				ctx.completion.choices[0]?.message.content ?? "{}",
			),
		}),
	],
)
