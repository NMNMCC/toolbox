import type {IO} from "@pipechain/core"
import type {OpenAIIn, OpenAIOut} from "../../mod.ts"

export const pii =
	<NI extends Partial<OpenAIIn>, NO extends OpenAIOut>(
		patterns: RegExp[] = [
			/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, // Email
			/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone (US)
		],
	) =>
	async (input: NI, next: IO<NI, NO>) => {
		// Mask input
		if (input.messages) {
			for (const msg of input.messages) {
				if (typeof msg.content === "string") {
					let content = msg.content
					for (const pattern of patterns) {
						content = content.replace(pattern, "[REDACTED]")
					}
					msg.content = content
				}
			}
		}

		const response = await next(input)

		// Mask output
		const message = response.choices[0]?.message
		if (message && message.content) {
			let content = message.content
			for (const pattern of patterns) {
				content = content.replace(pattern, "[REDACTED]")
			}
			message.content = content
		}

		return response
	}
