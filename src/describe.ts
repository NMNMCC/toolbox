import type {z, ZodType} from "zod"
import type {AnyObject} from "./util.ts"
import type {Middleware as Middleware, MiddlewareNext} from "./middleware.ts"
import OpenAI from "openai"

export type Describable<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = (input: z.input<Input>) => Promise<z.output<Output>>

export type DescribableInput = ZodType<any, AnyObject>
export type DescribableOutput = ZodType<any>

export type Described<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = Describable<Input, Output> & Description<Input, Output>

export type Description<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = {name: string; description: string; input: Input; output: Output}

export type LanguageModelMiddleware<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = Middleware<
	LanguageModelMiddlewareInput<Input, Output>,
	LanguageModelMiddlewareOutput<Input, Output>
>

export type LanguageModelMiddlewareNext<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = MiddlewareNext<
	LanguageModelMiddlewareInput<Input, Output>,
	LanguageModelMiddlewareOutput<Input, Output>
>

export type LanguageModelMiddlewareInput<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = {
	context: LanguageModelContext<Input, Output>
	messages: OpenAI.ChatCompletionMessageParam[]
}
export type LanguageModelMiddlewareOutput<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = {
	context: LanguageModelContext<Input, Output>
	completion: OpenAI.Chat.Completions.ChatCompletion
}

export type LanguageModelContext<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = {
	description: LanguageModelDescription<Input, Output>

	input_processor: LanguageModelInputProcessor<Input>
	output_processor: LanguageModelOutputProcessor<Output>
	middlewares: LanguageModelMiddleware<Input, Output>[]

	usage: OpenAI.CompletionUsage
}

export type LanguageModelInputProcessor<Input extends DescribableInput> = (
	input: z.input<Input>,
) => Promise<OpenAI.ChatCompletionMessageParam[]>

export type LanguageModelOutputProcessor<Output extends DescribableOutput> = (
	output: OpenAI.Chat.Completions.ChatCompletion,
) => Promise<z.output<Output>>

export type Imports<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = [
	LanguageModelInputProcessor<Input>,
	LanguageModelOutputProcessor<Output>,
	...LanguageModelMiddleware<Input, Output>[],
]

export type LanguageModelDescription<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = Description<Input, Output> &
	OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
		client?: OpenAI
	}

export const describe: {
	<
		Input extends DescribableInput = DescribableInput,
		Output extends DescribableOutput = DescribableOutput,
	>(
		describable: Describable<Input, Output>,
		description: Description<Input, Output>,
	): Described<Input, Output>
	<
		Input extends DescribableInput = DescribableInput,
		Output extends DescribableOutput = DescribableOutput,
	>(
		imports: Imports<Input, Output>,
		description: LanguageModelDescription<Input, Output>,
	): Described<Input, Output>
} = <
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
>(
	...inputs:
		| [Describable<Input, Output>, Description<Input, Output>]
		| [Imports<Input, Output>, LanguageModelDescription<Input, Output>]
): Described<Input, Output> => {
	const [first, second] = inputs

	if (Array.isArray(first) && "model" in second) {
		return Object.assign(
			async (input: z.input<Input>): Promise<z.output<Output>> => {
				const [input_processor, output_processor, ...middlewares] =
					first

				const chain = middlewares.reduceRight(
					(
						prev: LanguageModelMiddlewareNext<Input, Output>,
						curr: LanguageModelMiddleware<Input, Output>,
					) =>
						(
							input: LanguageModelMiddlewareInput<Input, Output>,
						): Promise<
							LanguageModelMiddlewareOutput<Input, Output>
						> =>
							curr(input, prev),
					async (
						input: LanguageModelMiddlewareInput<Input, Output>,
					): Promise<
						LanguageModelMiddlewareOutput<Input, Output>
					> => {
						const client = second.client ?? new OpenAI()
						return {
							context: input.context,
							completion: await client.chat.completions.create({
								...second,
								messages: input.messages,
							}),
						}
					},
				)

				return await input_processor(input)
					.then(messages =>
						chain({
							context: {
								description: second,

								input_processor,
								output_processor,
								middlewares,

								usage: {
									completion_tokens: 0,
									prompt_tokens: 0,
									total_tokens: 0,
								},
							},
							messages,
						}),
					)
					.then(({completion}) => output_processor(completion))
			},
			second,
		)
	}

	return Object.assign(
		first as Describable<Input, Output>,
		second as Description<Input, Output>,
	) as Described<Input, Output>
}
