import type {IO} from "@pipechain/core"
import type {OpenAIIn, OpenAIOut} from "../../mod.ts"

// This middleware wraps tools to add retry logic.
export const toolRetry =
	<NI extends Partial<OpenAIIn>, NO extends OpenAIOut>(
		maxRetries: number = 3,
	) =>
	async (input: NI, next: IO<NI, NO>) => {
		if (input.tools) {
			input.tools = input.tools.map(tool => {
				if (tool.type !== "function") return tool
				const originalExecute = (tool as any).execute
				if (!originalExecute) return tool

				return {
					...tool,
					execute: async (args: any, context: any) => {
						let lastError
						for (let i = 0; i < maxRetries; i++) {
							try {
								return await originalExecute(args, context)
							} catch (e) {
								lastError = e
								console.warn(
									`Tool ${tool.function.name} failed (attempt ${i + 1}/${maxRetries}):`,
									e,
								)
							}
						}
						throw lastError
					},
				}
			})
		}
		return next(input)
	}
