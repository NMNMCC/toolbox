import {defer} from "@pipechain/core"
import OpenAI from "openai"

export type OpenAIIn = OpenAI.ChatCompletionCreateParamsNonStreaming & {
	client?: OpenAI
}
export type OpenAIOut = OpenAI.ChatCompletion

export const openai = defer(({client = new OpenAI(), ...params}: OpenAIIn) =>
	client.chat.completions.create(params),
)
