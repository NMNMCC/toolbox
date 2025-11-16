import type {
	DescribableInput,
	DescribableOutput,
	LanguageModelMiddlewareContext,
	LanguageModelFinalizer,
} from "../describe.ts"

export const finalizer =
	<
		Input extends DescribableInput = DescribableInput,
		Output extends DescribableOutput = DescribableOutput,
	>(
		parse: (content: string) => any = JSON.parse,
	): LanguageModelFinalizer<Input, Output> =>
	async ctx => {
		const content = ctx.history.at(-1)?.[1].at(-1)?.choices[0]
			?.message.content
		if (!content) {
			throw new FinalizerContentNotFoundError(ctx)
		}

		return await parse(content)
	}

export class FinalizerContentNotFoundError<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> extends Error {
	context: LanguageModelMiddlewareContext<Input, Output>

	constructor(context: LanguageModelMiddlewareContext<Input, Output>) {
		super("Finalizer: Content not found")
		this.context = context
	}
}
