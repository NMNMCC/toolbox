import {z} from "zod"
import {react, tool} from "./react.ts"
import {duplex} from "@pipechain/core"
import {openai} from "../main.ts"

const log = tool({
	name: "log",
	description: "Logs a message to the console",
	parameters: z.object({message: z.string().describe("The message to log")}),
	execute: async ({message}) => {
		console.log("log:", message)
	},
})

const bot = duplex(openai({model: "gpt-5-nano"}))
	.pipe(react({max_turns: 3, tools: [log]}))
	.pipe((input: string, next) => {
		return next({
			messages: [{role: "user", content: `Log this message: "${input}"`}],
		})
	})

console.log(await bot("Hello, PipeChain!"))
