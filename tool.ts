import type StandardSchemaV1 from "@standard-schema/spec"

export interface Tool<
	In extends StandardSchemaV1.StandardSchemaV1 =
		StandardSchemaV1.StandardSchemaV1,
	Out extends StandardSchemaV1.StandardSchemaV1 =
		StandardSchemaV1.StandardSchemaV1,
> {
	name: string
	description: string
	in: In
	out: Out
	function: (
		i: StandardSchemaV1.StandardSchemaV1.InferOutput<In>,
	) => StandardSchemaV1.StandardSchemaV1.InferInput<Out>
}

export const tool = <
	In extends StandardSchemaV1.StandardSchemaV1,
	Out extends StandardSchemaV1.StandardSchemaV1,
>(
	name: string,
	description: string,
	i: In,
	o: Out,
	func: (
		i: StandardSchemaV1.StandardSchemaV1.InferOutput<In>,
	) => StandardSchemaV1.StandardSchemaV1.InferInput<Out>,
): Tool<In, Out> => {
	return {
		name,
		description,
		in: i,
		out: o,
		function: func,
	}
}

export const stop_symbol = Symbol("stop")

export const stop = <T extends any>(
	t: T extends void | undefined | null ? never : T,
): T =>
	Object.assign(Object(t as any), {
		[stop_symbol]: true,
	}) as any
