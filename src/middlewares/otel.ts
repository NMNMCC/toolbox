import {
	type Attributes,
	context as otelContext,
	SpanStatusCode,
	trace,
} from "@opentelemetry/api"

import type {
	DescribableInput,
	DescribableOutput,
	LanguageModelMiddleware,
	LanguageModelMiddlewareContext,
	LanguageModelMiddlewareNext,
} from "../describe.ts"

export type OtelMiddlewareOptions<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = {
	name?: string

	span_name?:
		| string
		| ((context: LanguageModelMiddlewareContext<Input, Output>) => string)
}

export const otel =
	<
		Input extends DescribableInput = DescribableInput,
		Output extends DescribableOutput = DescribableOutput,
	>(
		options: OtelMiddlewareOptions<Input, Output> = {},
	): LanguageModelMiddleware<Input, Output> =>
	async (
		context: LanguageModelMiddlewareContext<Input, Output>,
		next: LanguageModelMiddlewareNext<Input, Output>,
	) => {
		const tracer = trace.getTracer(options.name ?? "@nmnmcc/toolbox")

		const span_name =
			typeof options.span_name === "function"
				? options.span_name(context)
				: (options.span_name ?? context.description.name ?? "llm.call")

		const raw_attributes = {
			"llm.system": "openai",
			"llm.request.type": "chat",
			"llm.tool.name": context.description.name,
			"llm.model_name": context.description.model,
			"llm.request.temperature": context.description.temperature,
			"llm.request.top_p": context.description.top_p,
			"llm.request.max_completion_tokens":
				context.description.max_completion_tokens,
			"llm.frequency_penalty": context.description.frequency_penalty,
			"llm.presence_penalty": context.description.presence_penalty,
			"llm.input": JSON.stringify(context.input),
		}

		const attributes: Attributes = {}
		for (const [key, value] of Object.entries(raw_attributes)) {
			if (value != null) {
				attributes[key] = value
			}
		}

		const span = tracer.startSpan(span_name, {attributes})

		return await otelContext.with(
			trace.setSpan(otelContext.active(), span),
			async () => {
				try {
					const result = await next(context)

					const last_history = result.history.at(-1)
					if (last_history) {
						const [prompt, completions] = last_history
						const last_completion = completions.at(-1)

						span.setAttribute(
							"llm.messages",
							JSON.stringify([prompt]),
						)

						if (last_completion) {
							const {usage, choices} = last_completion
							if (usage) {
								span.setAttributes({
									"llm.usage.prompt_tokens":
										usage.prompt_tokens,
									"llm.usage.completion_tokens":
										usage.completion_tokens,
									"llm.usage.total_tokens":
										usage.total_tokens,
								})
							}

							span.setAttribute(
								"llm.choices",
								JSON.stringify(choices),
							)

							const finish_reason = choices
								.map(choice => choice.finish_reason)
								.join(", ")
							span.setAttribute(
								"llm.finish_reason",
								finish_reason,
							)

							const tool_calls = choices
								.flatMap(choice => choice.message.tool_calls)
								.filter(Boolean)
							if (tool_calls.length > 0) {
								span.setAttribute(
									"llm.tool_calls",
									JSON.stringify(tool_calls),
								)
							}
						}
					}

					span.setStatus({code: SpanStatusCode.OK})
					return result
				} catch (error) {
					if (error instanceof Error) {
						span.recordException(error)
						span.setStatus({
							code: SpanStatusCode.ERROR,
							message: error.message,
						})
					} else {
						span.setStatus({
							code: SpanStatusCode.ERROR,
							message: "Unknown error",
						})
					}
					throw error
				} finally {
					span.end()
				}
			},
		)
	}
