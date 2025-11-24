import type {IO} from "@pipechain/core"
import type {OpenAIIn, OpenAIOut} from "../../mod.ts"

export type HumanApproval = (
	message: OpenAIOut["choices"][0]["message"],
) => Promise<boolean | string>

export const humanInTheLoop =
	<NI extends Partial<OpenAIIn>, NO extends OpenAIOut>(
		approve: HumanApproval,
	) =>
	async (input: NI, next: IO<NI, NO>) => {
		const response = await next(input)
		const message = response.choices[0]?.message

		if (!message) return response

		const approval = await approve(message)

		if (approval === false) {
			throw new Error("Human rejected the response")
		}

		if (typeof approval === "string") {
			// Human modified the response
			message.content = approval
		}

		return response
	}
