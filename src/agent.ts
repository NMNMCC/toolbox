import OpenAI from "openai"
import {z} from "zod"
import {Tool} from "./tool.ts"
import {final, type AnyObject} from "./util.ts"
import {EventEmitter} from "events"

export type AgentDefinition<Context = unknown> = {
	name: string
	description: string
	system?: string
	tools?: Tool<Context, any>[]
}

export type AgentEvents<Context = unknown> = {
	"agent.started": //
	[ctx: Context]
	"agent.reasoning.started": //
	[
		ctx: Context,
		data: {params: OpenAI.ChatCompletionCreateParamsNonStreaming},
	]
	"agent.reasoning.completed": //
	[ctx: Context, data: {message: OpenAI.ChatCompletionMessageParam}]
	"agent.completed": //
	[ctx: Context, data: {messages: OpenAI.ChatCompletionMessageParam[]}]
	"agent.failed": //
	[ctx: Context, data: {error: Error}]
	"tool.started": //
	[ctx: Context, data: {tool: Tool<Context>; id: string}]
	"tool.completed": //
	[ctx: Context, data: {tool: Tool<Context>; id: string; content: any}]
	"tool.failed": //
	[ctx: Context, data: {tool: Tool<Context>; id: string; error: Error}]
}

/**
 * Reason -> Act -> Observe
 */
export class Agent<Context = unknown> implements Agent<Context> {
	private emitter = new EventEmitter()

	constructor(x: AgentDefinition<Context>) {
		Object.assign(this, x)
	}

	on<K extends keyof AgentEvents<Context>>(
		name: K,
		listener: (...args: AgentEvents<Context>[K]) => void,
	): this {
		this.emitter.on(name, listener)
		return this
	}

	off<K extends keyof AgentEvents<Context>>(
		name: K,
		listener: (...args: AgentEvents<Context>[K]) => void,
	): this {
		this.emitter.off(name, listener)
		return this
	}

	once<K extends keyof AgentEvents<Context>>(
		name: K,
		listener: (...args: AgentEvents<Context>[K]) => void,
	): this {
		this.emitter.once(name, listener)
		return this
	}

	emit<K extends keyof AgentEvents<Context>>(
		name: K,
		...args: AgentEvents<Context>[K]
	): boolean {
		return this.emitter.emit(name, ...args)
	}

	to_tool<
		Input extends AnyObject = AnyObject,
		Output extends AnyObject = AnyObject,
	>(
		ctx: Context,
		input: z.ZodType<Input>,
		output: z.ZodType<Output>,
		{messages, ...others}: AgentRunOptions,
	): Tool<Context, Input> {
		return new Tool({
			name: this.name,
			description: this.description,
			input,
			function: (_context, input) =>
				final(
					this.generate(ctx, {
						...others,
						response_format: {
							type: "json_schema",
							json_schema: {
								name: this.name,
								description: output.description ?? "",
								schema: z.toJSONSchema(output),
								strict: false,
							},
						},
						messages: [
							...messages,
							{role: "user", content: JSON.stringify(_context)},
							{role: "user", content: JSON.stringify(input)},
						],
					}),
				),
		})
	}

	async *generate(
		ctx: Context,
		{
			client: client = new OpenAI(),
			messages: _messages,
			...others
		}: AgentRunOptions,
	): AsyncGenerator<
		OpenAI.ChatCompletionAssistantMessageParam,
		{context: Context; messages: OpenAI.ChatCompletionMessageParam[]},
		OpenAI.ChatCompletionAssistantMessageParam
	> {
		const messages: OpenAI.ChatCompletionMessageParam[] = [
			{role: "system", content: this.system ?? ""},
			...(_messages ? _messages : []),
		]
		this.emit("agent.started", ctx)

		try {
			while (true) {
				const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
					...others,
					messages,
					tools:
						this.tools?.map(tool => tool.to_function_tool()) ?? [],
				}

				this.emit("agent.reasoning.started", ctx, {params})

				const message = yield (
					await client.chat.completions.create(params)
				).choices[0]!.message

				if (!message) {
					throw new Error(`expect create chat completions response`)
				}
				messages.push(message)

				this.emit("agent.reasoning.completed", ctx, {message})

				const function_tool_calls = message.tool_calls?.filter(
					call => call.type === "function",
				)

				if (!function_tool_calls?.length) {
					this.emit("agent.completed", ctx, {
						messages: messages.slice(1),
					})
					return {context: ctx, messages: messages.slice(1)}
				}

				const results: {id: string; content: unknown}[] = []
				for (const {
					id,
					function: {name, arguments: args},
				} of function_tool_calls) {
					const tool = this.tools?.find(tool => tool.name === name)!

					try {
						this.emit("tool.started", ctx, {tool, id})

						const content = await tool.function(
							ctx,
							tool.input.parse(JSON.parse(args)),
						)
						this.emit("tool.completed", ctx, {tool, id, content})

						results.push({id, content})
					} catch (e) {
						this.emit("tool.failed", ctx, {
							tool,
							id,
							error:
								e instanceof Error ? e : new Error(String(e)),
						})
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
			this.emit("agent.failed", ctx, {
				error: e instanceof Error ? e : new Error(String(e)),
			})
			throw e
		}
	}

	async run(
		ctx: Context,
		options: AgentRunOptions,
		...middlewares: ((
			value: OpenAI.ChatCompletionAssistantMessageParam,
		) => Promise<OpenAI.ChatCompletionAssistantMessageParam>)[]
	): Promise<AgentRunResult<Context>> {
		const [head = async o => o, ...tail] = middlewares
		const generator = this.generate(ctx, options)
		let result = await generator.next()
		while (!result.done) {
			result = await generator.next(
				await tail.reduce(
					(acc, middleware) => acc.then(middleware),
					head(result.value),
				),
			)
		}
		return result.value
	}
}

export interface Agent<Context = unknown> extends AgentDefinition<Context> {}

export type AgentRunOptions = {
	client?: OpenAI
} & OpenAI.ChatCompletionCreateParamsNonStreaming

export type AgentRunResult<Context = unknown> = {
	context: Context
	messages: OpenAI.ChatCompletionMessageParam[]
}
