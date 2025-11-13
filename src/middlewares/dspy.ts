import {
	describe,
	type LanguageModelMiddleware,
	type DescribableInput,
	type DescribableOutput,
	type Described,
} from "../describe.ts"
import {z} from "zod"
import {zodFunction} from "openai/helpers/zod"

export const chain_of_thought = <
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
>(): LanguageModelMiddleware<Input, Output> => {
	return async (context, next) => {
		context.messages.unshift({
			role: "system",
			content:
				"Think step-by-step to arrive at the correct answer. Don't make assumptions about what values to plug into functions. Exclusively use the functions provided to you. Return a JSON object with a single property 'result'.",
		})
		return await next(context)
	}
}

export type ProgramOfThoughtOptions = {
	engine: (code: string) => Promise<any>
	max_steps?: number
}

const generate_code_schema = z.object({
	code: z
		.string()
		.describe("The code to be executed in the sandbox environment."),
})

export const program_of_thought = <
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
>({
	engine,
	max_steps = 5,
}: ProgramOfThoughtOptions): LanguageModelMiddleware<Input, Output> => {
	const generate_code_tool = describe(
		{
			name: "generate_code",
			description:
				"Generates and executes code in a sandbox environment.",
			input: generate_code_schema,
			output: z.any(),
		},
		async input => engine(input.code),
	)

	const tools_by_name = new Map([[generate_code_tool.name, generate_code_tool]])

	return async (context, next) => {
		context.tools ??= []
		context.tools.push(
			zodFunction({
				name: generate_code_tool.name,
				description: generate_code_tool.description,
				parameters: generate_code_tool.input,
			}),
		)

		for (let i = 0; i < max_steps; i++) {
			const output = await next(context)

			const message = output.completion.choices[0]?.message
			if (!message) {
				return output
			}
			context.messages.push(message)

			if (!message.tool_calls) {
				return output
			}
			const tool_outputs = await Promise.all(
				message.tool_calls.map(async tool_call => {
					if (tool_call.type !== "function") {
						return {
							tool_call_id: tool_call.id,
							role: "tool" as const,
							content: `Error: Tool type "${tool_call.type}" is not supported.`,
						}
					}

					const tool = tools_by_name.get(tool_call.function.name)
					if (!tool) {
						return {
							tool_call_id: tool_call.id,
							role: "tool" as const,
							content: `Error: Tool "${tool_call.function.name}" not found.`,
						}
					}

					try {
						const result = await tool(
							JSON.parse(tool_call.function.arguments),
						)
						return {
							tool_call_id: tool_call.id,
							role: "tool" as const,
							content: JSON.stringify(result),
						}
					} catch (error) {
						return {
							tool_call_id: tool_call.id,
							role: "tool" as const,
							content: `Error: ${
								error instanceof Error
									? error.message
									: "Unknown error"
							}`,
						}
					}
				}),
			)

			context.messages.push(...tool_outputs)
		}

		throw new Error("ProgramOfThought: Max steps reached")
	}
}

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
		context.tools ??= []
		context.tools.push(
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

			const message = output.completion.choices[0]?.message
			if (!message) {
				return output
			}
			context.messages.push(message)

			if (!message.tool_calls) {
				return output
			}
			const tool_outputs = await Promise.all(
				message.tool_calls.map(async tool_call => {
					if (tool_call.type !== "function") {
						return {
							tool_call_id: tool_call.id,
							role: "tool" as const,
							content: `Error: Tool type "${tool_call.type}" is not supported.`,
						}
					}

					const tool = tools_by_name.get(tool_call.function.name)
					if (!tool) {
						return {
							tool_call_id: tool_call.id,
							role: "tool" as const,
							content: `Error: Tool "${tool_call.function.name}" not found.`,
						}
					}

					try {
						const result = await tool(
							JSON.parse(tool_call.function.arguments),
						)
						return {
							tool_call_id: tool_call.id,
							role: "tool" as const,
							content: JSON.stringify(result),
						}
					} catch (error) {
						return {
							tool_call_id: tool_call.id,
							role: "tool" as const,
							content: `Error: ${
								error instanceof Error
									? error.message
									: "Unknown error"
							}`,
						}
					}
				}),
			)

			context.messages.push(...tool_outputs)
		}

		throw new Error("ReAct: Max steps reached")
	}
}
