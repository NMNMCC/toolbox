import {zodFunction} from "openai/helpers/zod"
import type {
	DescribableInput,
	DescribableOutput,
	Described,
	LanguageModelMiddlewareContext,
	LanguageModelMiddleware,
} from "../describe.ts"

import type OpenAI from "openai"

export type ReActOptions = {max_steps: number; tools: Described<any, any>[]}

export const react = <
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
>({
	max_steps,
	tools,
}: ReActOptions): LanguageModelMiddleware<Input, Output> => {
	const tools_by_name = new Map(tools.map(tool => [tool.name, tool]))

	return async (context, next) => {
		context.description.tools ??= []
		context.description.tools.push(
			...tools.map(tool =>
				zodFunction({
					name: tool.name,
					description: tool.description,
					parameters: tool.input,
				}),
			),
		)

		for (let i = 0; i < max_steps; i++) {
			const output = await next(context)

			const message = output.history.at(-1)?.[1].at(-1)
				?.choices[0]?.message
			if (!message) {
				return output
			}
			output.history.push([message, []])

			if (!message.tool_calls) {
				return output
			}
			const tool_outputs: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] =
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

			output.history.push(
				...tool_outputs.map(
					t =>
						[t, []] as [
							OpenAI.Chat.Completions.ChatCompletionMessageParam,
							OpenAI.Chat.Completions.ChatCompletion[],
						],
				),
			)
		}

		throw new ReActMaxStepsReachedError(context)
	}
}

export class ReActMaxStepsReachedError extends Error {
	context: LanguageModelMiddlewareContext<any, any>

	constructor(context: LanguageModelMiddlewareContext<any, any>) {
		super("ReAct: Max steps reached")
		this.context = context
	}
}
