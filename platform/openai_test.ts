import {OpenAI} from "./openai.ts"
import {OpenAI as o} from "openai"
import {assertEquals} from "@std/assert"
import "dotenv/config"
import {stop, tool} from "../tool.ts"
import z from "zod"

const platform = new OpenAI(new o())

Deno.test(`platform/${platform.name}`, async () => {
	assertEquals(platform.name, platform.name)
	assertEquals(platform.description, platform.description)

	const response = await platform.call({
		model: "glm-4.6",
		messages: [{
			type: "user",
			content: "Say Hello by calling the tool!",
		}],
		tools: [
			tool(
				"Hello",
				"Say Hello!",
				z.object({
					name: z.string().describe(
						"just give a random name without asking",
					),
				}),
				z.void(),
				({name}: {name: string}) => {
					console.log(`Tool Calling: Hello, ${name}!`)
					return stop({})
				},
			),
		],
	})

	console.log(response)
})
