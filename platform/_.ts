import type {Message} from "../message.ts"
import type {Tool} from "../tool.ts"

export abstract class Platform {
	public abstract readonly name: string
	public abstract readonly description: string

	public abstract call(c: CallRequest<any>): Promise<CallResponse>
	public abstract tool(t: Tool<any, any>): any
}

export type CallRequest<
	Config extends object = Record<PropertyKey, never>,
	CustomModel = never,
	CustomMessage = never,
	CustomTool = never,
> = {
	config?: Config
	model: CustomModel | (string & Record<never, never>)
	messages: (Message | CustomMessage)[]
	tools?: (Tool<any, any> | CustomTool)[]
}

export type CallResponse = {
	id: string
	message: string
	usage: CallUsage
}

export type CallUsage = {
	in: number
	out: number
}
