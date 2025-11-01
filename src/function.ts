import type {z, ZodType} from "zod"
import type {AnyObject} from "../dist/util.js"
import type {Promisable} from "./util.ts"

export type DescribableFunction<
	Input extends ZodType<any, AnyObject> = ZodType<any, AnyObject>,
	Output extends ZodType<any> = ZodType<any>,
> = (input: z.input<Input>) => Promisable<z.output<Output>>

export type DescribedFunction<
	Input extends ZodType<any, AnyObject> = ZodType<any, AnyObject>,
	Output extends ZodType<any> = ZodType<any>,
> = DescribableFunction<Input, Output> & FunctionDescription<Input, Output>

export type FunctionDescription<
	Input extends ZodType<any, AnyObject> = ZodType<any, AnyObject>,
	Output extends ZodType<any> = ZodType<any>,
> = {name: string; description: string; input: Input; output: Output}

export const describe = <
	Input extends ZodType<any, AnyObject> = ZodType<any, AnyObject>,
	Output extends ZodType<any> = ZodType<any>,
>(
	func: DescribableFunction<Input, Output>,
	desc: FunctionDescription<Input, Output>,
): DescribedFunction<Input, Output> => Object.assign(func, desc)
