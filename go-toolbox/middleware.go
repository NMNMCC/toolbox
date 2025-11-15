package toolbox

import "context"

// Middleware is a function that wraps another handler, allowing for composition
// of behaviors like caching, retry, logging, etc.
type Middleware[Input, Output any] func(
	ctx context.Context,
	input Input,
	next HandlerFunc[Input, Output],
) (Output, error)

// HandlerFunc is the function signature for handlers that can be wrapped by middleware
type HandlerFunc[Input, Output any] func(context.Context, Input) (Output, error)

// Chain combines multiple middlewares into a single middleware
func Chain[Input, Output any](middlewares ...Middleware[Input, Output]) Middleware[Input, Output] {
	return func(ctx context.Context, input Input, next HandlerFunc[Input, Output]) (Output, error) {
		// Build the chain from right to left
		handler := next
		for i := len(middlewares) - 1; i >= 0; i-- {
			mw := middlewares[i]
			prevHandler := handler
			handler = func(ctx context.Context, input Input) (Output, error) {
				return mw(ctx, input, prevHandler)
			}
		}
		return handler(ctx, input)
	}
}
