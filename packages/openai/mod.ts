import {pipe, type Next} from "@pipechain/core"
import OpenAI from "openai"

export type Params =
	OpenAI.ChatCompletionCreateParams.ChatCompletionCreateParamsNonStreaming

export const openai =
	<const P extends Partial<Params>>(
		params: P,
		client = new OpenAI(),
	): Next<Omit<Params, keyof P>, OpenAI.ChatCompletion> =>
	input =>
		client.chat.completions.create({...params, ...input} as never)

if (import.meta.main) {
	const echo = pipe(
		openai({model: "gpt-3.5-turbo", messages: []}),
		(result, next) => {
			return next(result)
		},
	)

	echo({})
}
