import type {IO} from "@pipechain/core"
import type {OpenAIIn, OpenAIOut} from "../../mod.ts"

export const modelCallLimit = <
	NI extends Partial<OpenAIIn>,
	NO extends OpenAIOut,
>(
	maxCalls: number,
) => {
	let calls = 0
	return async (input: NI, next: IO<NI, NO>) => {
		if (calls >= maxCalls) {
			throw new Error(`Model call limit exceeded: ${maxCalls}`)
		}
		calls++
		return next(input)
	}
}

export const toolCallLimit = <
	NI extends Partial<OpenAIIn>,
	NO extends OpenAIOut,
>(
	maxCalls: number,
) => {
	// This middleware needs to inspect the response to count tool calls
	// Or it wraps the tools?
	// If we want to limit the *number of tool calls made by the model*, we check the output.
	let calls = 0
	return async (input: NI, next: IO<NI, NO>) => {
		const response = await next(input)
		const message = response.choices[0]?.message
		if (message?.tool_calls) {
			calls += message.tool_calls.length
			if (calls > maxCalls) {
				throw new Error(`Tool call limit exceeded: ${maxCalls}`)
			}
		}
		return response
	}
}
