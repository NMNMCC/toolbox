import type {
	DescribableInput,
	DescribableOutput,
	LanguageModelMiddleware,
	LanguageModelMiddlewareContext,
	LanguageModelMiddlewareNext,
} from "../describe.ts"

export const retry =
	<
		Input extends DescribableInput = DescribableInput,
		Output extends DescribableOutput = DescribableOutput,
	>(
		max: number,
	): LanguageModelMiddleware<Input, Output> =>
	async (
		context: LanguageModelMiddlewareContext<Input, Output>,
		next: LanguageModelMiddlewareNext<Input, Output>,
	) => {
		let last: unknown
		for (let i = 0; i < max; i++) {
			try {
				return await next(context)
			} catch (error) {
				last = error
			}
		}
		throw last
	}
