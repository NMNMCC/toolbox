import type {IO} from "@pipechain/core"
import type {OpenAIIn, OpenAIOut} from "../../mod.ts"

export const fallback =
	<NI extends Partial<OpenAIIn>, NO extends OpenAIOut>(models: string[]) =>
	async (input: NI, next: IO<NI, NO>) => {
		try {
			return await next(input)
		} catch (error) {
			if (models.length === 0) throw error

			// Try next model
			const [nextModel, ...rest] = models
			console.warn(
				`Model ${input.model} failed, falling back to ${nextModel}. Error: ${error}`,
			)

			return fallback<NI, NO>(rest)({...input, model: nextModel}, next)
		}
	}
