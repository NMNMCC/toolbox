import OpenAI from "openai"
import {zodFunction} from "openai/helpers/zod"
import {
	describe,
	type DescribedFunction,
	type FunctionDescription,
} from "./function.ts"
import type {AnyObject} from "./util.ts"
import {toJSONSchema, type ZodType} from "zod"

export type AgentDesciption<
	Input extends ZodType<
		OpenAI.ChatCompletionMessageParam[],
		AnyObject
	> = ZodType<OpenAI.ChatCompletionMessageParam[], AnyObject>,
	Output extends ZodType<AnyObject & AgentTrace, AnyObject> = ZodType<
		AnyObject & AgentTrace,
		AnyObject
	>,
> = FunctionDescription<Input, Output> & {
	instruction: string
	imports: DescribedFunction[]
}

export type AgentConfig = Omit<
	OpenAI.ChatCompletionCreateParamsNonStreaming,
	"messages"
> & {client?: OpenAI; messages?: OpenAI.ChatCompletionMessageParam[]}

export type DescribedAgent<
	Input extends ZodType<any, AnyObject> = ZodType<any, AnyObject>,
	Output extends ZodType<AnyObject & AgentTrace, AnyObject> = ZodType<
		AnyObject & AgentTrace,
		AnyObject
	>,
> = DescribedFunction<Input, Output> & {
	use: (middleware: AgentMiddleware) => DescribedAgent<Input, Output>
	derive: (update: {
		config?: (config: AgentConfig) => AgentConfig
		middlewares?: (middlewares: AgentMiddleware[]) => AgentMiddleware[]
	}) => DescribedAgent<Input, Output>
}

export type AgentMiddlewareNext = (
	message: OpenAI.ChatCompletionMessageParam[],
) => Promise<OpenAI.ChatCompletionMessageParam[]>

export type AgentMiddleware = (
	next: AgentMiddlewareNext,
) => Promise<AgentMiddlewareNext>

export type AgentTrace = {
	__trace__: {
		messages: OpenAI.ChatCompletionMessageParam[]
		function_calls: OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall[]
		usage: OpenAI.CompletionUsage
	}
}

export const define = <
	Input extends ZodType<
		OpenAI.ChatCompletionMessageParam[],
		AnyObject
	> = ZodType<OpenAI.ChatCompletionMessageParam[], AnyObject>,
	Output extends ZodType<AnyObject & AgentTrace, AnyObject> = ZodType<
		AnyObject & AgentTrace,
		AnyObject
	>,
>(
	description: AgentDesciption<Input, Output>,
	config: AgentConfig,
	...middlewares: AgentMiddleware[]
): DescribedAgent<Input, Output> => {
	const func = describe(async input => {
		const client = config.client ?? new OpenAI()

		const chain: Promise<AgentMiddlewareNext> = middlewares.reduceRight(
			async (next: Promise<AgentMiddlewareNext>, curr: AgentMiddleware) =>
				await curr(await next),
			Promise.resolve(async o => o),
		)

		const process = async (
			message: OpenAI.ChatCompletionMessageParam,
		): Promise<OpenAI.ChatCompletionMessageParam[]> =>
			(await chain)([message])

		const messages: OpenAI.ChatCompletionMessageParam[] = [
			...(await process({
				role: "system",
				content: description.instruction,
			})),
			...(
				await Promise.all(
					[
						...(config.messages ?? []),
						...description.input.parse(input),
					].map(process),
				)
			).flat(1),
		]
		const function_calls: OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall[] =
			[]
		const usage: OpenAI.CompletionUsage = {
			completion_tokens: 0,
			prompt_tokens: 0,
			total_tokens: 0,
		}
		while (true) {
			const raw = await client.chat.completions.create({
				model: config?.model ?? "gpt-4o",
				messages,
				tools: description.imports.map(func =>
					zodFunction({
						name: func.name,
						description: func.description,
						parameters: func.input,
						function: func,
					}),
				),
				response_format: {
					type: "json_schema",
					json_schema: {
						name: description.name,
						description: description.description,
						strict: true,
						schema: toJSONSchema(description.output, {io: "input"}),
					},
				},
			})
			const _usage = raw.usage
			const message = raw.choices[0]?.message!
			messages.push(...(await process(message)))
			if (_usage) {
				usage.completion_tokens += _usage.completion_tokens
				usage.prompt_tokens += _usage.prompt_tokens
				usage.total_tokens += usage.total_tokens
			}

			const function_tool_calls = message.tool_calls?.filter(
				call => call.type === "function",
			)
			if (!function_tool_calls?.length) {
				return description.output
					.transform(msg =>
						Object.assign(msg, {
							__trace__: {messages, function_calls, usage},
						} satisfies AgentTrace),
					)
					.parse(JSON.parse(message.content ?? "{}"))
			}
			function_calls.push(...function_tool_calls)
			messages.push(
				...(
					await Promise.all(
						function_tool_calls
							.map<
								Promise<OpenAI.ChatCompletionToolMessageParam>
							>(
								async ({
									id,
									function: {arguments: arg, name},
								}) => {
									const func = description.imports.find(
										func => func.name === name,
									)!
									return {
										role: "tool",
										content: JSON.stringify(
											await func(
												func.input.parse(
													JSON.parse(arg),
												),
											),
										),
										tool_call_id: id,
									}
								},
							)
							.map(message => message.then(process)),
					)
				)
					.flat(1)
					.filter(Boolean),
			)
		}
	}, description)

	const use = (middleware: AgentMiddleware): DescribedAgent<Input, Output> =>
		define(description, config, ...middlewares, middleware)

	const derive = (update: {
		config?: (config: AgentConfig) => AgentConfig
		middlewares?: (middlewares: AgentMiddleware[]) => AgentMiddleware[]
	}): DescribedAgent<Input, Output> =>
		define(
			description,
			update.config ? update.config(config) : config,
			...(update.middlewares
				? update.middlewares(middlewares)
				: middlewares),
		)

	return Object.assign(func, {use, derive})
}
