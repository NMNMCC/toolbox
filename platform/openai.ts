import type {CallRequest, CallResponse, Platform} from "./_.ts"
import type {Tool} from "../tool.ts"
import type {Message} from "../message.ts"

import type {OpenAI as o} from "openai"
import {logger} from "../logger.ts"
import z, {type ZodType} from "zod"
import {stop_symbol} from "../tool.ts"

const l = logger.child({module: "flavor/openai"})

export class OpenAI implements Platform {
	name = "openai"
	description = "openai.com"

	constructor(private client: o) {
		l.info("Initialized OpenAI Flavor")
	}

	async call(
		c: CallRequest<
			Omit<
				o.ChatCompletionCreateParams.ChatCompletionCreateParamsNonStreaming,
				"model" | "messages" | "tools" | "n"
			>,
			o.ChatCompletionCreateParams["model"]
		>,
	): Promise<CallResponse> {
		const raw_input:
			o.ChatCompletionCreateParams.ChatCompletionCreateParamsNonStreaming =
				{
					...c.config,
					model: c.model,
					messages: c.messages.map((m) => {
						const result:
							o.ChatCompletionCreateParams.ChatCompletionCreateParamsNonStreaming[
								"messages"
							][number] = {} as any

						switch (m.type) {
							case "system":
							case "model":
								{
									result.role = "assistant"
									result.content = m.content
								}
								break
							case "user":
								{
									result.role = "user"
									result.content = ""

									if (typeof m.content === "string") {
										result.content = m.content
									} else if (m.content.type === "image") {
										result.content = [{
											type: "image_url",
											image_url: {
												url: m.content.url,
											},
										}]
									} else {
										throw new Error("Not Implemented")
									}
								}
								break
							case "tool":
								{
									result.role = "tool"
									result.content = m.content
								}
								break
						}

						return result
					}),
					tools: c.tools?.map((t) => this.tool(t)),
				}

		l.info({input: raw_input}, "Calling OpenAI API")

		const raw = await this.client.chat.completions.create(raw_input)

		l.info({raw}, "Received OpenAI API response")

		const message = raw.choices[0].message || ""

		if (message.tool_calls && message.tool_calls.length > 0) {
			l.info({count: message.tool_calls.length}, "Tool calls detected")

			const results: any[] = []

			let break_reason: "completed" | "stopped" = "completed"
			for (const [idx, call] of message.tool_calls.entries()) {
				if (call.type === "function") {
					const tool = c.tools![idx]
					l.info({id: call.id, call, tool}, "Calling tool")

					const parameters = tool.in.parse(
						JSON.parse(call.function.arguments),
					)
					const result = await c.tools![idx].function(parameters)
					l.info({id: call.id, result}, "Tool call completed")

					if (result[stop_symbol]) {
						break_reason = "stopped"
						l.info({id: call.id}, "Tool call requested to stop")
						break
					}

					results.push(result)
				} else {
					throw new Error("Not Implemented")
				}
			}

			l.info({results}, "Tool calls completed")

			switch (break_reason) {
				case "stopped":
					return {
						id: raw.id,
						message: results.at(-1),
						usage: {
							in: raw.usage?.prompt_tokens || -1,
							out: raw.usage?.completion_tokens || -1,
						},
					}
				case "completed":
					return this.call({
						...c,
						messages: [
							...c.messages,
							...results.map((r): Message => ({
								type: "tool",
								content: typeof r === "string"
									? r
									: JSON.stringify(r, null, 2),
							})),
						],
					})
			}
		}

		const result: CallResponse = {
			id: raw.id,
			message: raw.choices[0].message.content || "",
			usage: {
				in: raw.usage?.prompt_tokens || -1,
				out: raw.usage?.completion_tokens || -1,
			},
		}

		l.info({raw, result}, "Received OpenAI API response")

		return result
	}

	tool(t: Tool<ZodType, ZodType>): o.ChatCompletionTool {
		// deno-lint-ignore no-explicit-any
		const parameters = z.toJSONSchema(t.in)
		l.info({tool: t, parameters}, "Converting tool to OpenAI format")

		return {
			type: "function",
			function: {
				name: t.name,
				description: t.description,
				parameters,
			},
		}
	}
}
