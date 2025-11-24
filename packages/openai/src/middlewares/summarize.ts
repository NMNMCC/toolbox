import type {IO} from "@pipechain/core"
import type {OpenAIIn, OpenAIOut} from "../../mod.ts"

export type SummarizeOptions = {maxMessages?: number; model?: string}

export const summarize =
	<NI extends Partial<OpenAIIn>, NO extends OpenAIOut>({
		maxMessages = 10,
		model,
	}: SummarizeOptions = {}) =>
	async (input: NI, next: IO<NI, NO>) => {
		const messages = input.messages || []
		if (messages.length <= maxMessages) {
			return next(input)
		}

		const systemMessage = messages.find(m => m.role === "system")
		const otherMessages = messages.filter(m => m.role !== "system")

		// Keep the last (maxMessages - 1 (system) - 1 (summary)) messages
		// We want to summarize the older messages.
		const keepCount = Math.max(1, maxMessages - 2)
		const toSummarize = otherMessages.slice(0, -keepCount)
		const toKeep = otherMessages.slice(-keepCount)

		if (toSummarize.length === 0) {
			return next(input)
		}

		// Perform summarization
		// We use the same client to summarize
		const client = input.client
		if (!client) {
			// If no client, we can't summarize using LLM. Just truncate?
			// Or throw? Or just pass through?
			console.warn(
				"Summarize middleware: No client found in input, skipping summarization.",
			)
			return next(input)
		}

		const modelToUse = model || input.model
		if (!modelToUse) {
			console.warn(
				"Summarize middleware: No model specified, skipping summarization.",
			)
			return next(input)
		}

		const summaryResponse = await client.chat.completions.create({
			model: modelToUse,
			messages: [
				{
					role: "system",
					content:
						"Summarize the following conversation history concisely.",
				},
				...toSummarize,
			],
		})

		const summary = summaryResponse.choices[0]?.message?.content || ""

		input.messages = [
			...(systemMessage ? [systemMessage] : []),
			{
				role: "system",
				content: `Previous conversation summary: ${summary}`,
			},
			...toKeep,
		]

		return next(input)
	}
