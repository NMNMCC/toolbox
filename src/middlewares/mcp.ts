import type {
	DescribableInput,
	DescribableOutput,
	LanguageModelMiddleware,
} from "../describe.ts"

export type McpOptions = {
	apiKey: string
	userId: string
}

export const mcp = <
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
>({
	apiKey,
	userId,
}: McpOptions): LanguageModelMiddleware<Input, Output> => {
	return async (context, next) => {
		context.headers = {
			...context.headers,
			"mcp-api-key": apiKey,
			"mcp-user-id": userId,
		}
		return next(context)
	}
}
