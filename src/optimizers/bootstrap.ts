import type {
	Described,
	DescribableInput,
	DescribableOutput,
	Optimizer,
	LanguageModelMiddleware,
} from "../describe.ts"
import type {ChatCompletionMessageParam} from "openai/resources/index.mjs"

export type BootstrapFewShotOptions<
	Input extends DescribableInput,
	Output extends DescribableOutput,
> = {
	metric: (
		expected: Described<Input, Output>,
		predicted: Described<Input, Output>,
	) => Promise<boolean>
	max_bootstrapped_demos?: number
	max_labeled_demos?: number
	max_rounds?: number
}

export const bootstrap_few_shot = <
	Input extends DescribableInput,
	Output extends DescribableOutput,
>(
	options: BootstrapFewShotOptions<Input, Output>,
): Optimizer<Input, Output> => {
	return async (student, teacher, trainset) => {
		const {
			metric,
			max_bootstrapped_demos = 4,
			max_rounds = 1,
		} = options

		const demos = new Set()

		for (let round = 0; round < max_rounds; round++) {
			for (const example of trainset) {
				if (demos.size >= max_bootstrapped_demos) {
					break
				}
				const prediction = await teacher(example.input)
				if (await metric(example.output, prediction)) {
					demos.add({input: example.input, output: prediction})
				}
			}
		}

		const new_middlewares: LanguageModelMiddleware<Input, Output>[] = [
			async (context, next) => {
				context.messages.unshift(
					...([...demos].map(
						(demo: any) =>
							({
								role: "system",
								content: `input: ${JSON.stringify(
									demo.input,
								)}\noutput: ${JSON.stringify(demo.output)}`,
							}) as ChatCompletionMessageParam,
					)),
				)
				return await next(context)
			},
		]

		const new_student = Object.assign(student, {
			middlewares: new_middlewares,
		})

		return new_student
	}
}
