package toolbox

// Middleware represents a middleware function that processes a context
// and calls the next middleware in the chain.
type Middleware[Input, Output any] func(
	ctx Context[Input, Output],
	next Next[Input, Output],
) (CompletionContext[Input, Output], error)

// Next represents the next middleware in the chain.
type Next[Input, Output any] func(ctx Context[Input, Output]) (CompletionContext[Input, Output], error)
