import type {
	DescribableInput,
	DescribableOutput,
	LanguageModelCompletionContext,
	LanguageModelMiddleware,
	LanguageModelMiddlewareContext,
	LanguageModelMiddlewareNext,
} from "../describe.ts"

export const aggregator =
	<
		Input extends DescribableInput = DescribableInput,
		Output extends DescribableOutput = DescribableOutput,
	>(
		...middlewares: LanguageModelMiddleware<Input, Output>[]
	): LanguageModelMiddleware<Input, Output> =>
	async (
		context: LanguageModelMiddlewareContext<Input, Output>,
		next: LanguageModelMiddlewareNext<Input, Output>,
	): Promise<LanguageModelCompletionContext<Input, Output>> => {
		const chain = middlewares.reduceRight<
			LanguageModelMiddlewareNext<Input, Output>
		>(
			(
				prev: LanguageModelMiddlewareNext<Input, Output>,
				curr: LanguageModelMiddleware<Input, Output>,
			) =>
				async (
					ctx: LanguageModelMiddlewareContext<Input, Output>,
				): Promise<LanguageModelCompletionContext<Input, Output>> =>
					curr(ctx, prev),
			next,
		)

		return chain(context)
	}
