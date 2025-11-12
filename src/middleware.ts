export type Middleware<Input, Output> = (
	context: Input,
	next: MiddlewareNext<Input, Output>,
) => Promise<Output>

export type MiddlewareNext<Input, Output> = (context: Input) => Promise<Output>
