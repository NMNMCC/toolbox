import type {z, ZodType} from "zod"
import type {AnyObject} from "./util.ts"
import type {Middleware, MiddlewareNext} from "./middleware.ts"
import OpenAI from "openai"

export type Describable<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = (input: InferInput<Input>) => Promise<InferOutput<Output>>

export type DescribableInput = ZodType<any, AnyObject | string>
export type DescribableOutput = ZodType<any>
export type InferInput<T> = z.input<T>
export type InferOutput<T> = z.output<T>

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
	LanguageModelMiddlewareContext<Input, Output>,
	LanguageModelMiddlewareContext<Input, Output>
>

export type LanguageModelMiddlewareNext<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = MiddlewareNext<
	LanguageModelMiddlewareContext<Input, Output>,
	LanguageModelMiddlewareContext<Input, Output>
>

export type LanguageModelInputContext<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = {
	description: LanguageModelDescription<Input, Output>

	initializer: LanguageModelInitializer<Input, Output>
	middlewares: LanguageModelMiddleware<Input, Output>[]
	finalizer: LanguageModelFinalizer<Input, Output>

	input: InferInput<Input>
}

export type LanguageModelMiddlewareContext<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = LanguageModelInputContext<Input, Output> & {
	history: [
		OpenAI.Chat.ChatCompletionMessageParam,
		OpenAI.Chat.Completions.ChatCompletion[],
	][]
}

export type LanguageModelOutputContext<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = LanguageModelMiddlewareContext<Input, Output> & {
	output: InferOutput<Output>
}

export type LanguageModelInitializer<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = (
	context: LanguageModelInputContext<Input, Output>,
) => Promise<LanguageModelMiddlewareContext<Input, Output>>

export type LanguageModelFinalizer<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = (
	context: LanguageModelMiddlewareContext<Input, Output>,
) => Promise<InferOutput<Output>>

export type LanguageModelImports<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = [
	initializer: LanguageModelInitializer<Input, Output>,
	...middlewares: LanguageModelMiddleware<Input, Output>[],
	finalizer: LanguageModelFinalizer<Input, Output>,
]

export type LanguageModelDescription<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = Description<Input, Output> &
	Partial<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming> &
	Required<
		Pick<
			OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
			"model"
		>
	> & {client?: OpenAI}

export const describe: {
	<
		const Input extends DescribableInput = DescribableInput,
		const Output extends DescribableOutput = DescribableOutput,
	>(
		description: Description<Input, Output>,
		describable: Describable<Input, Output>,
	): Described<Input, Output>
	<
		const Input extends DescribableInput = DescribableInput,
		const Output extends DescribableOutput = DescribableOutput,
	>(
		description: LanguageModelDescription<Input, Output>,
		imports: LanguageModelImports<Input, Output>,
	): Described<Input, Output>
} = <
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
>(
	...inputs:
		| [Description<Input, Output>, Describable<Input, Output>]
		| [
				LanguageModelDescription<Input, Output>,
				LanguageModelImports<Input, Output>,
		  ]
): Described<Input, Output> => {
	const [description, second] = inputs

	if (Array.isArray(second) && "model" in description) {
		return Object.assign(
			async (input: InferInput<Input>): Promise<InferOutput<Output>> => {
				const initializer = second[0]
				const finalizer = second.at(-1) as LanguageModelFinalizer<
					Input,
					Output
				>
				const middlewares = second.slice(
					1,
					-1,
				) as LanguageModelMiddleware<Input, Output>[]

				const chain = middlewares.reduceRight(
					(
						prev: LanguageModelMiddlewareNext<Input, Output>,
						curr: LanguageModelMiddleware<Input, Output>,
					) =>
						(
							input: LanguageModelMiddlewareContext<
								Input,
								Output
							>,
						): Promise<
							LanguageModelMiddlewareContext<Input, Output>
						> =>
							curr(input, prev),
					async (
						context: LanguageModelMiddlewareContext<Input, Output>,
					): Promise<
						LanguageModelMiddlewareContext<Input, Output>
					> => {
						const client = description.client ?? new OpenAI()

						const completion = await client.chat.completions.create(
							{
								...description,
								messages: context.history.flatMap(
									([message, completions]) => {
										return [
											message,
											...completions
												.flatMap(
													completion =>
														completion.choices,
												)
												.map(choice => choice.message),
										]
									},
								),
							},
						)

						context.history.at(-1)![1].push(completion)

						return context
					},
				)

				const context: LanguageModelInputContext<Input, Output> = {
					description,

					initializer,
					finalizer,
					middlewares,

					input,
				}

				return await initializer(context).then(chain).then(finalizer)
			},
			description,
		)
	}

	return Object.assign(
		second as Describable<Input, Output>,
		description as Description<Input, Output>,
	) as Described<Input, Output>
}
