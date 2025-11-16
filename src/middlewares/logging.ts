import type {
	DescribableInput,
	DescribableOutput,
	LanguageModelMiddleware,
	LanguageModelMiddlewareContext,
	LanguageModelMiddlewareNext,
} from "../describe.ts"

export type LoggingEvent<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = {
	context: LanguageModelMiddlewareContext<Input, Output>
	result: LanguageModelMiddlewareContext<Input, Output>
	elapsed_ms: number
}

export type LoggingMiddlewareOptions<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = {log?: (event: LoggingEvent<Input, Output>) => void | Promise<void>}

const default_log = <
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
>({
	context,
	result,
	elapsed_ms,
}: LoggingEvent<Input, Output>): void => {
	const usage = result.history.at(-1)?.[1].at(-1)?.usage

	console.log(`llm:${context.description.name}`, {
		elapsed_ms,
		prompt_tokens: usage?.prompt_tokens ?? 0,
		completion_tokens: usage?.completion_tokens ?? 0,
		total_tokens: usage?.total_tokens ?? 0,
	})
}

export const logging =
	<
		Input extends DescribableInput = DescribableInput,
		Output extends DescribableOutput = DescribableOutput,
	>(
		options: LoggingMiddlewareOptions<Input, Output> = {},
	): LanguageModelMiddleware<Input, Output> =>
	async (
		context: LanguageModelMiddlewareContext<Input, Output>,
		next: LanguageModelMiddlewareNext<Input, Output>,
	) => {
		const started_at = Date.now()
		const result = await next(context)
		const elapsed_ms = Date.now() - started_at

		const log = options.log ?? default_log<Input, Output>
		await log({context, result, elapsed_ms})

		return result
	}
