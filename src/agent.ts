import OpenAI from "openai"
import {zodFunction} from "openai/helpers/zod"
import {
	describe,
	type DescribedFunction,
	type FunctionDescription,
} from "./function.ts"
import type {AnyObject} from "./util.ts"
import z, {toJSONSchema, type ZodType} from "zod"

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
	config: (config: AgentConfig) => DescribedAgent<Input, Output>
}

export const agent = <
	Input extends ZodType<any, AnyObject> = ZodType<any, AnyObject>,
	Output extends ZodType<AnyObject> = ZodType<AnyObject>,
>(
	description: AgentDesciption<Input, Output>,
	config: AgentConfig,
): DescribedAgent<Input, Output> => {
	return Object.assign(
		describe(async input => {
			const client = config.client ?? new OpenAI()

			const messages: OpenAI.ChatCompletionMessageParam[] = []
			while (true) {
				const message = (
					await client.chat.completions.create({
						model: config?.model ?? "gpt-4o",
						messages: [
							{role: "system", content: description.instruction},
							...(config.messages ?? []),
							...description.input.parse(input),
						],
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
					message,
					...(
						await Promise.all(
							function_tool_calls.map<
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
							),
						)
					).filter(Boolean),
				)
			}
		}, description),
		{config: (config: AgentConfig) => agent(description, config)},
	)
}

agent(
	{
		name: "",
		description: "",
		imports: [],
		instruction: "",
		input: z.object().transform(() => ""),
		output: z.object(),
	},
	{model: "chatgpt-4o-latest"},
)
