import type {
	DescribableInput,
	DescribableOutput,
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
		LanguageModelMiddlewareContext<Input, Output>["history"] | undefined
	>
	set: (
		key: string,
		value: LanguageModelMiddlewareContext<Input, Output>["history"],
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
	max_history?: number
}

const default_key = <
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
>(
	context: LanguageModelMiddlewareContext<Input, Output>,
): string => context.description.name

const limit_history = <
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
>(
	history: LanguageModelMiddlewareContext<Input, Output>["history"],
	max_history?: number,
): LanguageModelMiddlewareContext<Input, Output>["history"] => {
	if (max_history === undefined || history.length <= max_history) {
		return history
	}
	return history.slice(-max_history)
}

export const memory =
	<
		Input extends DescribableInput = DescribableInput,
		Output extends DescribableOutput = DescribableOutput,
	>({
		store,
		key = default_key,
		max_history,
	}: MemoryMiddlewareOptions<Input, Output>): LanguageModelMiddleware<
		Input,
		Output
	> =>
	async (
		context: LanguageModelMiddlewareContext<Input, Output>,
		next: LanguageModelMiddlewareNext<Input, Output>,
	) => {
		const memory_key = key(context)
		const history = (await store.get(memory_key)) ?? []

		const with_history: LanguageModelMiddlewareContext<Input, Output> = {
			...context,
			history: limit_history(
				[...history, ...context.history],
				max_history,
			),
		}

		const result = await next(with_history)
		const reply = result.history.at(-1)?.[1].at(-1)
		if (!reply) {
			return result
		}

		const updated_history = limit_history(result.history, max_history)
		await store.set(memory_key, updated_history)

		return {...result, history: updated_history}
	}
