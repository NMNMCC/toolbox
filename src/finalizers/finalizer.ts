import type {
	DescribableInput,
	DescribableOutput,
	LanguageModelCompletionContext,
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
		const content = ctx.completion.choices[0]?.message.content
		if (!content) {
			throw new FinalizerContentNotFoundError(ctx)
		}

		return {...ctx, output: await parse(content)}
	}

export class FinalizerContentNotFoundError<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> extends Error {
	context: LanguageModelCompletionContext<Input, Output>

	constructor(context: LanguageModelCompletionContext<Input, Output>) {
		super("Finalizer: Content not found")
		this.context = context
	}
}
