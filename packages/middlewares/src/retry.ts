import type {Middleware} from "@pipechain/core"

export const retry =
	<I, O>(max: number, delayMs: number = 0): Middleware<I, O> =>
	async (input, next) => {
		try {
			return await next(input)
		} catch (error) {
			if (max <= 0) {
				throw error
			}
			if (delayMs > 0) {
				await new Promise(resolve => setTimeout(resolve, delayMs))
			}

			return retry<I, O>(max - 1, delayMs)(input, next)
		}
	}
