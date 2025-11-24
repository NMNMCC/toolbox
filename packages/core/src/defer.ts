import type {IO} from "./util.ts"

export type Defer<I, O> = <PI extends Partial<I>>(
	pi: PI,
) => IO<Omit<I, keyof PI>, O>

export const defer =
	<I, O>(func: IO<I, O>): Defer<I, O> =>
	x =>
	y =>
		func(Object.assign(x, y) as I)
