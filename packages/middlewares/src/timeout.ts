import type {Middleware} from "@pipechain/core"

export const timeout =
	<I, O>(ms: number): Middleware<I, O> =>
	async (input, next) => {
		return await Promise.race([
			next(input),
			new Promise<O>((_, reject) =>
				setTimeout(
					() =>
						reject(
							new TimeoutError(
								`Operation timed out after ${ms} ms`,
							),
						),
					ms,
				),
			),
		])
	}

export class TimeoutError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "TimeoutError"
	}
}
