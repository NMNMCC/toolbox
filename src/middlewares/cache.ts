import type {
	DescribableInput,
	DescribableOutput,
	LanguageModelCompletionContext,
	LanguageModelMiddleware,
	LanguageModelMiddlewareContext,
	LanguageModelMiddlewareNext,
} from "../describe.ts"

export type CacheStore<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = {
	get: (
		key: string,
	) =>
		| LanguageModelCompletionContext<Input, Output>
		| undefined
		| Promise<LanguageModelCompletionContext<Input, Output> | undefined>
	set: (
		key: string,
		value: LanguageModelCompletionContext<Input, Output>,
	) => void | Promise<void>
}

export type CacheKeyFn<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = (context: LanguageModelMiddlewareContext<Input, Output>) => string

export type CacheMiddlewareOptions<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = {store: CacheStore<Input, Output>; key?: CacheKeyFn<Input, Output>}

const default_key = <
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
>(
	context: LanguageModelMiddlewareContext<Input, Output>,
): string => `${context.description.name}:${JSON.stringify(context.input)}`

export class CacheMiss<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> extends Error {
	context: LanguageModelMiddlewareContext<Input, Output>

	constructor(context: LanguageModelMiddlewareContext<Input, Output>) {
		super("Cache miss")
		this.context = context
	}
}

export const cache =
	<
		Input extends DescribableInput = DescribableInput,
		Output extends DescribableOutput = DescribableOutput,
	>({
		store,
		key = default_key,
	}: CacheMiddlewareOptions<Input, Output>): LanguageModelMiddleware<
		Input,
		Output
	> =>
	async (
		context: LanguageModelMiddlewareContext<Input, Output>,
		next: LanguageModelMiddlewareNext<Input, Output>,
	): Promise<LanguageModelCompletionContext<Input, Output>> => {
		const cache_key = key(context)
		const cached = await store.get(cache_key)
		if (cached) {
			return cached
		}

		const result = await next(context)
		await store.set(cache_key, result)

		return result
	}
