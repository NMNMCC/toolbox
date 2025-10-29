import OpenAI from "openai"
import {z} from "zod"
import type {AnyObject} from "./util.js"

export type ToolFunction<
	Context = unknown,
	Input extends AnyObject = AnyObject,
> = (ctx: Context, input: Input) => any

export type ToolDefinition<
	Context = unknown,
	Input extends AnyObject = AnyObject,
> = {
	name: string
	description: string
	input: z.ZodType<Input>
	function: ToolFunction<Context, Input>
}

export interface Tool<Context = unknown, Input extends AnyObject = AnyObject>
	extends ToolDefinition<Context, Input> {}

export class Tool<Context = unknown, Input extends AnyObject = AnyObject>
	implements ToolDefinition<Context, Input>
{
	constructor(x: ToolDefinition<Context, Input>) {
		Object.assign(this, x)
	}

	to_function_tool(): OpenAI.ChatCompletionFunctionTool {
		return {
			type: "function",
			function: {
				name: this.name,
				description: this.description,
				parameters: z.toJSONSchema(this.input),
				strict: true,
			},
		}
	}
}
