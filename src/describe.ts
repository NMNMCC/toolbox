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
	LanguageModelMiddlewareContext<Input, Output>,
	LanguageModelCompletionContext<Input, Output>
>

export type LanguageModelMiddlewareNext<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = MiddlewareNext<
	LanguageModelMiddlewareContext<Input, Output>,
	LanguageModelCompletionContext<Input, Output>
>

export type LanguageModelInputContext<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = {
	description: LanguageModelDescription<Input, Output>

	input_processor: LanguageModelInitializer<Input, Output>
	output_processor: LanguageModelFinalizer<Input, Output>
	middlewares: LanguageModelMiddleware<Input, Output>[]

	usage: OpenAI.CompletionUsage

	input: z.output<Input>
}

import {type IncomingHttpHeaders} from "node:http"

export type LanguageModelMiddlewareContext<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = LanguageModelInputContext<Input, Output> & {
	tools?: OpenAI.Chat.Completions.ChatCompletionFunctionTool[]
	messages: OpenAI.ChatCompletionMessageParam[]
	headers?: IncomingHttpHeaders
}

export type LanguageModelCompletionContext<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = LanguageModelMiddlewareContext<Input, Output> & {
	completion: OpenAI.Chat.Completions.ChatCompletion
}

export type LanguageModelOutputContext<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = LanguageModelCompletionContext<Input, Output> & {output: z.input<Output>}

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
	context: LanguageModelCompletionContext<Input, Output>,
) => Promise<LanguageModelOutputContext<Input, Output>>

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
	Omit<
		OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
		"messages"
	> &
	Partial<
		Pick<
			OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
			"messages"
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
			async (input: z.input<Input>): Promise<z.output<Output>> => {
				const initializer = second[0] as LanguageModelInitializer<
					Input,
					Output
				>
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
							LanguageModelCompletionContext<Input, Output>
						> =>
							curr(input, prev),
					async (
						context: LanguageModelMiddlewareContext<Input, Output>,
					): Promise<
						LanguageModelCompletionContext<Input, Output>
					> => {
						const client = description.client ?? new OpenAI()
						return {
							...context,
							completion: await client.chat.completions.create(
								{
									...description,
									messages: context.messages,
								},
								{headers: context.headers},
							),
						}
					},
				)

				const context: LanguageModelInputContext<Input, Output> = {
					description: description,

					input_processor: initializer,
					output_processor: finalizer,
					middlewares,

					usage: {
						completion_tokens: 0,
						prompt_tokens: 0,
						total_tokens: 0,
					},

					input: description.input.parse(input),
				}

				return description.output.parse(
					await initializer(context).then(chain).then(finalizer),
				)
			},
			description,
		)
	}

	return Object.assign(
		second as Describable<Input, Output>,
		description as Description<Input, Output>,
	) as Described<Input, Output>
}
