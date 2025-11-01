import OpenAI from "openai"
import {zodFunction} from "openai/helpers/zod"
import {
	describe,
	type DescribedFunction,
	type FunctionDescription,
} from "./function.ts"
import type {AnyObject, Promisable} from "./util.ts"
import {toJSONSchema, type ZodType} from "zod"

export type AgentDesciption<
	Input extends ZodType<
		OpenAI.ChatCompletionMessageParam[],
		AnyObject
	> = ZodType<OpenAI.ChatCompletionMessageParam[], AnyObject>,
	Output extends ZodType<AnyObject> = ZodType<AnyObject>,
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
	Output extends ZodType<AnyObject> = ZodType<AnyObject>,
> = DescribedFunction<Input, Output> & {
	derive: (update: {
		config?: (config: AgentConfig) => AgentConfig
		middlewares?: (middlewares: AgentMiddleware[]) => AgentMiddleware[]
	}) => DescribedAgent<Input, Output>
}

export type AgentMiddlewareNext = (
	message: OpenAI.ChatCompletionMessageParam[],
) => Promisable<OpenAI.ChatCompletionMessageParam[]>

export type AgentMiddleware = (
	next: AgentMiddlewareNext,
) => Promisable<AgentMiddlewareNext>

export const define = <
	Input extends ZodType<
		OpenAI.ChatCompletionMessageParam[],
		AnyObject
	> = ZodType<OpenAI.ChatCompletionMessageParam[], AnyObject>,
	Output extends ZodType<AnyObject> = ZodType<AnyObject>,
>(
	description: AgentDesciption<Input, Output>,
	config: AgentConfig,
	...middlewares: AgentMiddleware[]
): DescribedAgent<Input, Output> => {
	return Object.assign(
		describe(async input => {
			const client = config.client ?? new OpenAI()

			const chain: Promise<AgentMiddlewareNext> = middlewares.reduceRight(
				async (
					next: Promise<AgentMiddlewareNext>,
					curr: AgentMiddleware,
				) => await curr(await next),
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
			while (true) {
				const message = (
					await client.chat.completions.create({
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
								schema: toJSONSchema(description.output, {
									io: "input",
								}),
							},
						},
					})
				).choices[0]?.message!

				const function_tool_calls = message.tool_calls?.filter(
					call => call.type === "function",
				)
				if (!function_tool_calls?.length) {
					return description.output.parse(
						JSON.parse(message.content ?? "{}"),
					)
				}
				messages.push(
					...(await process(message)),
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
		}, description),
		{
			derive: (update: {
				config?: (config: AgentConfig) => AgentConfig
				middlewares?: (
					middlewares: AgentMiddleware[],
				) => AgentMiddleware[]
			}): DescribedAgent<Input, Output> =>
				define(
					description,
					update.config ? update.config(config) : config,
					...(update.middlewares
						? update.middlewares(middlewares)
						: middlewares),
				),
		},
	)
}
