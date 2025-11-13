import {zodResponseFormat} from "openai/helpers/zod"
import type {
	DescribableInput,
	DescribableOutput,
	LanguageModelInitializer,
} from "../describe.ts"
import {ZodObject} from "zod"

export const initializer =
	<
		Input extends DescribableInput = DescribableInput,
		Output extends DescribableOutput = DescribableOutput,
	>(
		system: string,
	): LanguageModelInitializer<Input, Output> =>
	async ctx => ({
		...ctx,
		description: {
			...ctx.description,
			response_format:
				ctx.description.output instanceof ZodObject
					? zodResponseFormat(
							ctx.description.output,
							ctx.description.name,
							{description: ctx.description.description},
						)
					: undefined,
		},
		messages: [
			{role: "system", content: system},
			{
				role: "user",
				content:
					[
						`# ${ctx.description.name}`,
						`${ctx.description.description}`,
						"-".repeat(8),
						`${JSON.stringify(ctx.input, null, 4)}`,
					].join("\n\n") + "\n",
			},
		],
	})
