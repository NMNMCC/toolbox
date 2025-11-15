package toolbox

// Middleware represents a middleware function that processes a context
// and calls the next middleware in the chain.
type Middleware[Input, Output any] func(
	ctx Input,
	next MiddlewareNext[Input, Output],
) (Output, error)

// MiddlewareNext represents the next function in the middleware chain.
type MiddlewareNext[Input, Output any] func(ctx Input) (Output, error)
