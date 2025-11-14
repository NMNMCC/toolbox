import {z} from "zod"

import {describe} from "../src/describe.ts"
import {initializer} from "../src/initializers/initializer.ts"
import {memory} from "../src/middlewares/memory.ts"
import {logging} from "../src/middlewares/logging.ts"
import {timeout} from "../src/middlewares/timeout.ts"
import {retry} from "../src/middlewares/retry.ts"
import {finalizer} from "../src/finalizers/finalizer.ts"

const ChatInput = z.object({
	session_id: z.string().describe("Stable id for a chat session"),
	message: z.string().describe("User message in this turn"),
})

const ChatOutput = z.object({reply: z.string()})

const messages_by_session = new Map<string, any>()

const store = {
	get(key: string) {
		return messages_by_session.get(key)
	},
	set(key: string, value: any) {
		messages_by_session.set(key, value)
	},
}

const chat_with_memory = describe(
	{
		name: "chat_with_memory",
		description:
			"Stateful chat assistant that keeps conversation context per session id.",
		input: ChatInput,
		output: ChatOutput,
		model: "gpt-4o",
	},
	[
		initializer(
			[
				"You are a helpful chat assistant.",
				"Use the conversation history to keep context across turns.",
				"Keep replies concise but friendly.",
			].join("\n"),
		),
		memory({store, max_messages: 30, key: ctx => ctx.input.session_id}),
		timeout(15_000),
		logging(),
		retry(2),
		finalizer(),
	],
)

async function main() {
	const session_id = "demo-session"

	const first = await chat_with_memory({
		session_id,
		message:
			"Hi, I'm planning a move to another city. Can you help me think it through?",
	})

	const second = await chat_with_memory({
		session_id,
		message: "I forgot, what pros and cons did we list so far?",
	})

	console.log("First reply:", first)
	console.log("Second reply:", second)
}

void main()
