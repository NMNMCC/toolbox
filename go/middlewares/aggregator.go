package middlewares

import "github.com/nmnmcc/toolbox"

// Aggregator composes multiple middlewares into a single middleware.
func Aggregator[Input, Output any](middlewares ...toolbox.Middleware[Input, Output]) toolbox.Middleware[Input, Output] {
	return func(ctx toolbox.Context[Input, Output], next toolbox.Next[Input, Output]) (toolbox.CompletionContext[Input, Output], error) {
		// Build chain by reducing from right to left
		chain := next
		for i := len(middlewares) - 1; i >= 0; i-- {
			mw := middlewares[i]
			prev := chain
			chain = func(ctx toolbox.Context[Input, Output]) (toolbox.CompletionContext[Input, Output], error) {
				return mw(ctx, prev)
			}
		}
		return chain(ctx)
	}
}
