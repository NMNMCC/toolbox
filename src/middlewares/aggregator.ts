import type {
	DescribableInput,
	DescribableOutput,
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
	) => {
		const chain = middlewares.reduceRight<
			LanguageModelMiddlewareNext<Input, Output>
		>(
			(
				prev: LanguageModelMiddlewareNext<Input, Output>,
				curr: LanguageModelMiddleware<Input, Output>,
			) =>
				async (
					ctx: LanguageModelMiddlewareContext<Input, Output>,
				): Promise<LanguageModelMiddlewareContext<Input, Output>> =>
					curr(ctx, prev),
			next,
		)

		return chain(context)
	}
