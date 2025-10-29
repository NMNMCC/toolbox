import {z} from "zod"
import type {AnyObject, WithContext} from "./util.ts"
import type {Tool} from "./tool.ts"
import OpenAI from "openai"

export type AgentDefinition<
	Context = unknown,
	Input extends AnyObject = AnyObject,
	Output extends AnyObject = AnyObject,
> = {
	name: string
	description?: string
	system?: string
	input?: z.ZodType<Input>
	output?: z.ZodType<Output>
	tools?: Tool<Context, any>[]
}

/**
 * Reason -> Act -> Observe
 */
export class Agent<
	Context = unknown,
	Input extends AnyObject = AnyObject,
	Output extends AnyObject = AnyObject,
> implements Agent<Context, Input, Output>
{
	constructor(x: AgentDefinition<Context, Input, Output>) {
		Object.assign(this, x)
	}

	async *run(
		ctx: Context,
		{
			client: client = new OpenAI(),
			messages: _messages,
			...others
		}: AgentRunOptions,
	): AsyncGenerator<
		AgentRunTrace<Context>,
		Omit<AgentRunTraceAgentCompleted<Context>, "type">
	> {
		const messages: OpenAI.ChatCompletionMessageParam[] = [
			{role: "system", content: this.system ?? ""},
			...(_messages ? _messages : []),
		]
		yield {type: "agent.started", context: ctx}

		try {
			while (true) {
				const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
					...others,
					messages,
					tools:
						this.tools?.map(tool =>
							tool.to_openai_function_tool(),
						) ?? [],
				}

				yield {type: "agent.reasoning.started", context: ctx, params}

				const response = (await client.chat.completions.create(params))
					.choices[0]

				if (!response) {
					throw new Error(`expect create chat completions response`)
				}
				messages.push(response.message)

				yield {
					type: "agent.reasoning.completed",
					context: ctx,
					message: response.message,
				}

				const function_tool_calls =
					response?.message.tool_calls?.filter(
						call => call.type === "function",
					)

				if (!function_tool_calls?.length) {
					yield {
						type: "agent.completed",
						context: ctx,
						messages: messages.slice(1),
					}
					return {context: ctx, messages: messages.slice(1)}
				}

				const results: {id: string; content: unknown}[] = []
				for (const {
					id,
					function: {name, arguments: args},
				} of function_tool_calls) {
					const tool = this.tools?.find(tool => tool.name === name)!

					try {
						yield {type: "tool.started", context: ctx, tool, id}

						const content = await tool.function(
							ctx,
							tool.input.parse(JSON.parse(args)),
						)
						yield {
							type: "tool.completed",
							context: ctx,
							tool,
							id,
							content,
						}

						results.push({id, content})
					} catch (e) {
						yield {
							type: "tool.failed",
							context: ctx,
							id,
							tool,
							error:
								e instanceof Error ? e : new Error(String(e)),
						}
					}
				}

				messages.push(
					...results.map(
						({
							id,
							content,
						}): OpenAI.ChatCompletionToolMessageParam => ({
							role: "tool",
							tool_call_id: id,
							content: JSON.stringify(content),
						}),
					),
				)
			}
		} catch (e) {
			yield {
				type: "agent.failed",
				context: ctx,
				error: e instanceof Error ? e : new Error(String(e)),
			}
			throw e
		}
	}
}

export interface Agent<
	Context = unknown,
	Input extends AnyObject = AnyObject,
	Output extends AnyObject = AnyObject,
> extends AgentDefinition<Context, Input, Output> {}

export type AgentRunOptions = {
	client?: OpenAI
} & OpenAI.ChatCompletionCreateParamsNonStreaming

export type AgentRunResult<Context = unknown> =
	OpenAI.ChatCompletionAssistantMessageParam & {context: Context}

type Pair<X extends string, Y extends string> = `${X}.${Y}`

type AgentRunTraceToolBase<
	Context,
	T extends Pair<"tool", "started" | "completed" | "failed">,
> = WithContext<Context, {type: T; tool: Tool<Context>; id: string}>

export type AgentRunTraceToolStarted<Context = unknown> = AgentRunTraceToolBase<
	Context,
	"tool.started"
>

export type AgentRunTraceToolCompleted<Context = unknown> =
	AgentRunTraceToolBase<Context, "tool.completed"> & {content: any}

export type AgentRunTraceToolFailed<Context = unknown> = AgentRunTraceToolBase<
	Context,
	"tool.failed"
> & {error: Error}

export type AgentRunTraceTool<Context = unknown> =
	| AgentRunTraceToolStarted<Context>
	| AgentRunTraceToolCompleted<Context>
	| AgentRunTraceToolFailed<Context>

export type AgentRunTraceAgentBase<
	Context,
	T extends Pair<
		"agent",
		| "started"
		| "completed"
		| "failed"
		| Pair<"reasoning", "started" | "completed" | "failed">
	>,
> = WithContext<Context, {type: T}>

export type AgentRunTraceAgentStarted<Context = unknown> =
	AgentRunTraceAgentBase<Context, "agent.started">

export type AgentRunTraceAgentReasoningStarted<Context = unknown> =
	AgentRunTraceAgentBase<Context, "agent.reasoning.started"> & {
		params: OpenAI.ChatCompletionCreateParamsNonStreaming
	}

export type AgentRunTraceAgentReasoningCompleted<Context = unknown> =
	AgentRunTraceAgentBase<Context, "agent.reasoning.completed"> & {
		message: OpenAI.ChatCompletionMessageParam
	}

export type AgentRunTraceAgentReasoningFailed<Context = unknown> =
	AgentRunTraceAgentBase<Context, "agent.reasoning.failed"> & {error: Error}

export type AgentRunTraceAgentCompleted<Context = unknown> =
	AgentRunTraceAgentBase<Context, "agent.completed"> & {
		messages: OpenAI.ChatCompletionMessageParam[]
	}

export type AgentRunTraceAgentFailed<Context = unknown> =
	AgentRunTraceAgentBase<Context, "agent.failed"> & {error: Error}

export type AgentRunTraceAgent<Context> =
	| AgentRunTraceAgentStarted<Context>
	| AgentRunTraceAgentReasoningStarted<Context>
	| AgentRunTraceAgentReasoningCompleted<Context>
	| AgentRunTraceAgentReasoningFailed<Context>
	| AgentRunTraceAgentCompleted<Context>
	| AgentRunTraceAgentFailed<Context>

export type AgentRunTrace<Context = unknown> =
	| AgentRunTraceTool<Context>
	| AgentRunTraceAgent<Context>
