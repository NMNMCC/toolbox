import {connect, duplex} from "@pipechain/core"
import {openai} from "./main.ts"

const echo = duplex(openai({model: "gpt-5-nano"})).pipe(
	async (input: string, next) =>
		next({
			messages: [
				{
					role: "system",
					content:
						"You are a helpful assistant that echoes user messages.",
				},
				{role: "user", content: input},
			],
		}),
)

console.log(await echo("Hello, World!"))

const poem = duplex(openai({model: "gpt-5-nano"})).pipe(
	async (topic: string, next) =>
		next({
			messages: [
				{role: "user", content: `Write a haiku about ${topic}.`},
			],
		}),
)

const joke = duplex(openai({model: "gpt-5-nano"})).pipe(
	async (topic: string, next) =>
		next({
			messages: [{role: "user", content: `Tell a joke about ${topic}.`}],
		}),
)

const workflow = (input: string) =>
	connect({poem, joke}, async ({poem, joke}) => {
		return {
			poem: poem.choices[0]?.message.content ?? "",
			joke: joke.choices[0]?.message.content ?? "",
		}
	})({poem: input, joke: input})

console.log(await workflow("AI"))
