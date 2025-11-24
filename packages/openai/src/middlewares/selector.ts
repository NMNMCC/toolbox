import type {IO} from "@pipechain/core"
import type {OpenAIIn, OpenAIOut} from "../../mod.ts"

// This middleware assumes tools are passed in input.tools
// It filters them based on a selector function
export const toolSelector =
	<NI extends Partial<OpenAIIn>, NO extends OpenAIOut>(
		select: (
			tools: OpenAIIn["tools"],
			messages: OpenAIIn["messages"],
		) => OpenAIIn["tools"],
	) =>
	async (input: NI, next: IO<NI, NO>) => {
		if (input.tools) {
			input.tools = select(input.tools, input.messages)
		}
		return next(input)
	}
