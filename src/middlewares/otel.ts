import {context as otelContext, trace, SpanStatusCode} from "@opentelemetry/api"

import type {
	DescribableInput,
	DescribableOutput,
	LanguageModelCompletionContext,
	LanguageModelMiddleware,
	LanguageModelMiddlewareContext,
	LanguageModelMiddlewareNext,
} from "../describe.ts"

export type OtelMiddlewareOptions<
	Input extends DescribableInput = DescribableInput,
	Output extends DescribableOutput = DescribableOutput,
> = {
	/**
	 * Name used when creating the tracer.
	 *
	 * Defaults to "@nmnmcc/toolbox".
	 */
	name?: string

	/**
	 * Name of the span created for the LLM call.
	 *
	 * By default this uses the described function's name, falling back to
	 * "llm.call" if no name is available.
	 */
	span_name?:
		| string
		| ((context: LanguageModelMiddlewareContext<Input, Output>) => string)
}

/**
 * OpenTelemetry middleware for language-model based describables.
 *
 * This middleware creates a span around the underlying LLM call and records
 * basic usage information. It is designed to work with Traceloop's
 * OpenLLMetry JS setup – as long as OpenTelemetry is initialised and
 * exported with `@traceloop/openllmetry-js` or `@traceloop/node-server-sdk`,
 * these spans will automatically be captured.
 */
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
	): Promise<LanguageModelCompletionContext<Input, Output>> => {
		const tracer = trace.getTracer(options.name ?? "@nmnmcc/toolbox")

		const span_name =
			typeof options.span_name === "function"
				? options.span_name(context)
				: (options.span_name ?? context.description.name ?? "llm.call")

		const span = tracer.startSpan(span_name, {
			attributes: {
				"llm.system": "openai",
				"llm.operation": "chat.completion",
				"llm.tool.name": context.description.name,
			},
		})

		return await otelContext.with(
			trace.setSpan(otelContext.active(), span),
			async () => {
				try {
					const result = await next(context)

					const usage = result.usage
					span.setAttribute(
						"llm.usage.prompt_tokens",
						usage.prompt_tokens,
					)
					span.setAttribute(
						"llm.usage.completion_tokens",
						usage.completion_tokens,
					)
					span.setAttribute(
						"llm.usage.total_tokens",
						usage.total_tokens,
					)

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
