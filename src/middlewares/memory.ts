import type {
	DescribableInput,
	DescribableOutput,
	LanguageModelCompletionContext,
	LanguageModelMiddleware,
	LanguageModelMiddlewareContext,
	LanguageModelMiddlewareNext,
} from "../describe.ts"
import type {Promisable} from "../util.ts"

export type MemoryStore<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = {
	get: (
		key: string,
	) => Promisable<
		LanguageModelMiddlewareContext<Input, Output>["messages"] | undefined
	>
	set: (
		key: string,
		value: LanguageModelMiddlewareContext<Input, Output>["messages"],
	) => Promisable<void>
}

export type MemoryKeyFn<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = (context: LanguageModelMiddlewareContext<Input, Output>) => string

export type MemoryMiddlewareOptions<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = {
	store: MemoryStore<Input, Output>
	key?: MemoryKeyFn<Input, Output>
	max_messages?: number
}

const default_key = <
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
>(
	context: LanguageModelMiddlewareContext<Input, Output>,
): string => context.description.name

const limit_messages = <
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
>(
	messages: LanguageModelMiddlewareContext<Input, Output>["messages"],
	max_messages?: number,
): LanguageModelMiddlewareContext<Input, Output>["messages"] => {
	if (max_messages === undefined || messages.length <= max_messages) {
		return messages
	}
	return messages.slice(-max_messages)
}

export const memory =
	<
		Input extends DescribableInput = DescribableInput,
		Output extends DescribableOutput = DescribableOutput,
	>({
		store,
		key = default_key,
		max_messages,
	}: MemoryMiddlewareOptions<Input, Output>): LanguageModelMiddleware<
		Input,
		Output
	> =>
	async (
		context: LanguageModelMiddlewareContext<Input, Output>,
		next: LanguageModelMiddlewareNext<Input, Output>,
	): Promise<LanguageModelCompletionContext<Input, Output>> => {
		const memory_key = key(context)
		const history = (await store.get(memory_key)) ?? []

		const with_history: LanguageModelMiddlewareContext<Input, Output> = {
			...context,
			messages: limit_messages(
				[...history, ...context.messages],
				max_messages,
			),
		}

		const result = await next(with_history)
		const reply = result.completion.choices[0]?.message
		if (!reply) {
			return result
		}

		const updated_history = limit_messages(
			[...result.messages, reply],
			max_messages,
		)
		await store.set(memory_key, updated_history)

		return {...result, messages: updated_history}
	}
