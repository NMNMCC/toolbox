import type {
	DescribableInput,
	DescribableOutput,
	LanguageModelCompletionContext,
	LanguageModelMiddleware,
	LanguageModelMiddlewareContext,
	LanguageModelMiddlewareNext,
} from "../describe.ts"

export class TimeoutError<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> extends Error {
	context: LanguageModelMiddlewareContext<Input, Output>

	constructor(
		context: LanguageModelMiddlewareContext<Input, Output>,
		ms: number,
	) {
		super(`Timeout after ${ms}ms`)
		this.context = context
	}
}

export const timeout =
	<
		Input extends DescribableInput = DescribableInput,
		Output extends DescribableOutput = DescribableOutput,
	>(
		ms: number,
	): LanguageModelMiddleware<Input, Output> =>
	async (
		context: LanguageModelMiddlewareContext<Input, Output>,
		next: LanguageModelMiddlewareNext<Input, Output>,
	): Promise<LanguageModelCompletionContext<Input, Output>> => {
		let timer: ReturnType<typeof setTimeout> | undefined

		try {
			const result = await Promise.race<
				Promise<LanguageModelCompletionContext<Input, Output>>
			>([
				next(context),
				new Promise<never>((_, reject) => {
					timer = setTimeout(
						() => reject(new TimeoutError(context, ms)),
						ms,
					)
				}),
			])

			return result
		} finally {
			if (timer !== undefined) {
				clearTimeout(timer)
			}
		}
	}
