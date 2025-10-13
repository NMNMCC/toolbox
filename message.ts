export type Message = {
	type: "user"
	content: MessageContent
} | TextOnlyMessage

export type TextOnlyMessage = {
	type: "model" | "system" | "tool"
	content: MessageTextContext
}

export type MessageContent = MessageTextContext | MessageMediaContent

export type MessageTextContext = string

export type MessageMediaContent = {
	type: "audio" | "image" | "video"
	url: string
}
