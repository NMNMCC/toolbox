import {zodFunction} from "openai/helpers/zod"
import type {
	Described,
	LanguageModelContext,
	LanguageModelMiddleware,
} from "../describe.ts"

import type OpenAI from "openai"

export type ReActOptions = {max_steps: number; tools: Described[]}

export const react =
	({max_steps, tools}: ReActOptions): LanguageModelMiddleware =>
	async ({context, messages}, next) => {
		const tools_by_name = new Map(tools.map(tool => [tool.name, tool]))
		const openai_tools: OpenAI.Chat.Completions.ChatCompletionTool[] =
			tools.map(tool =>
				zodFunction({
					name: tool.name,
					description: tool.description,
					parameters: tool.input,
				}),
			)

		context.description.tools = openai_tools

		for (let i = 0; i < max_steps; i++) {
			const output = await next({context, messages})

			const message = output.completion.choices[0]?.message
			if (!message) {
				return output
			}
			messages.push(message)

			if (!message.tool_calls) {
				return {
					completion: output.completion,
					context: {...context, messages},
				}
			}
			const tool_outputs: OpenAI.ChatCompletionToolMessageParam[] =
				await Promise.all(
					message.tool_calls.map(async tool_call => {
						if (tool_call.type !== "function") {
							return {
								tool_call_id: tool_call.id,
								role: "tool",
								content: `Error: Tool type "${tool_call.type}" is not supported.`,
							}
						}

						const tool = tools_by_name.get(tool_call.function.name)
						if (!tool) {
							return {
								tool_call_id: tool_call.id,
								role: "tool",
								content: `Error: Tool "${tool_call.function.name}" not found.`,
							}
						}

						try {
							const result = await tool(
								JSON.parse(tool_call.function.arguments),
							)
							return {
								tool_call_id: tool_call.id,
								role: "tool",
								content: JSON.stringify(result),
							}
						} catch (error) {
							return {
								tool_call_id: tool_call.id,
								role: "tool",
								content: `Error: ${
									error instanceof Error
										? error.message
										: "Unknown error"
								}`,
							}
						}
					}),
				)

			messages.push(...tool_outputs)
		}

		throw new ReActMaxStepsReachedError(context, messages)
	}

export class ReActMaxStepsReachedError extends Error {
	context: LanguageModelContext<any, any>
	messages: OpenAI.ChatCompletionMessageParam[]

	constructor(
		context: LanguageModelContext<any, any>,
		messages: OpenAI.ChatCompletionMessageParam[],
	) {
		super("ReAct: Max steps reached")
		this.context = context
		this.messages = messages
	}
}
