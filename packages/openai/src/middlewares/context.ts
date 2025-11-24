import type {IO} from "@pipechain/core"
import type {OpenAIIn, OpenAIOut} from "../../mod.ts"

export const contextEditing =
	<NI extends Partial<OpenAIIn>, NO extends OpenAIOut>(
		edit: (messages: OpenAIIn["messages"]) => OpenAIIn["messages"],
	) =>
	async (input: NI, next: IO<NI, NO>) => {
		if (input.messages) {
			input.messages = edit(input.messages)
		}
		return next(input)
	}
