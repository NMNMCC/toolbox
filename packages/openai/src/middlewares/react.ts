import {simplex, type AnyObject, type IO} from "@pipechain/core"
import {type OpenAIIn, type OpenAIOut} from "../../mod.ts"
import type OpenAI from "openai"
import {toJSONSchema, ZodType} from "zod"

export type ReActOptions = {max_turns?: number; tools?: ReActTool<any, any>[]}

export const react =
	<NI extends Partial<OpenAIIn>, NO extends OpenAIOut>({
		max_turns = 10,
		tools = [],
	}: ReActOptions = {}) =>
	async (input: NI, next: IO<NI, NO>) => {
		input.messages ??= []

		if (!tools?.length) {
			const response = next(input)
			return {...response}
		}

		const map = new Map(tools.map(t => [t.function.name, t]))
		input.tools = tools.map(({execute, ...rest}) => rest)

		let turns = 0
		while (turns++ < max_turns) {
			const response = await next(input)

			const message = response.choices[0]?.message
			console.log("ReAct turn", turns, "message:", message)
			if (!message?.tool_calls?.length) return response

			input.messages.push(clean(message))

			for (const call of message.tool_calls) {
				if (call.type !== "function") continue

				const tool = map.get(call.function.name)
				if (!tool) {
					simplex(input.messages.push).pipe(clean)({
						role: "tool",
						tool_call_id: call.id,
						content: JSON.stringify(
							`Tool ${call.function.name} not found`,
						),
					})

					continue
				}

				try {
					input.messages.push({
						role: "tool",
						tool_call_id: call.id,
						content: await simplex(JSON.stringify)
							.pipe(tool.execute)
							.pipe(JSON.parse)(call.function.arguments),
					})
				} catch (e) {
					input.messages.push({
						role: "tool",
						tool_call_id: call.id,
						content: JSON.stringify(e),
					})
				}
			}
		}

		throw new ReActMaxTurnsExceededError(
			`ReAct max turns of ${max_turns} exceeded`,
		)
	}

export class ReActMaxTurnsExceededError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "ReactMaxTurnsExceededError"
	}
}

const clean = <T extends {}>(obj: T): T => {
	return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v)) as T
}

export type ReActTool<
	In extends AnyObject,
	Out,
> = OpenAI.ChatCompletionFunctionTool & {execute: IO<In, Out>}

export const tool = <In extends AnyObject, Out>({
	name,
	description,
	parameters,
	execute,
}: {
	name: string
	description: string
	parameters: OpenAI.FunctionParameters | ZodType<In>
	execute: (input: In) => Promise<Out>
}): ReActTool<In, Out> => {
	return {
		type: "function",
		function: {
			name,
			description,
			parameters:
				parameters instanceof ZodType
					? toJSONSchema(parameters)
					: parameters,
		},
		execute,
	}
}
