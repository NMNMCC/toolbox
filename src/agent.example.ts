import z from "zod"
import {Agent} from "./agent.ts"
import {Tool} from "./tool.ts"

const agent = new Agent<{todo: {status: "_" | "x"; content: string}[]}>({
	name: "simple_agent",
	description: 'it is just a "simple" agent',
	system: 'You help users complete tasks "simply"',
	tools: [
		new Tool({
			name: "add_todo",
			description: "add todo",
			input: z.object({
				todo: z.array(
					z.object({status: z.enum(["_", "x"]), content: z.string()}),
				),
			}),
			function: async (ctx, input) => {
				return ctx.todo.push(...input.todo)
			},
		}),
	],
})

const result = await agent.run(
	{todo: []},
	{
		model: "google/gemini-2.5-flash-lite",
		messages: [
			{
				role: "user",
				content:
					"make some todos to help me cleaning my house, don't ask me anything first",
			},
		],
	},
	async o => {
		console.log(o)
		if (o.content) {
			o.content +
				" after that, I will ask if you thinks it is not enough."
		}
		return o
	},
)

console.log("result:", JSON.stringify(result))
