package middlewares

import (
	"context"

	"github.com/nmnmcc/go-toolbox"
)

// Aggregator combines multiple middlewares into a single middleware
func Aggregator[Input, Output any](
	middlewares ...toolbox.LLMMiddleware[Input, Output],
) toolbox.LLMMiddleware[Input, Output] {
	return func(
		ctx context.Context,
		llmCtx *toolbox.LLMContext[Input, Output],
		next toolbox.LLMHandler[Input, Output],
	) error {
		// Build the chain from right to left
		handler := next
		for i := len(middlewares) - 1; i >= 0; i-- {
			mw := middlewares[i]
			prevHandler := handler
			handler = func(ctx context.Context, llmCtx *toolbox.LLMContext[Input, Output]) error {
				return mw(ctx, llmCtx, prevHandler)
			}
		}
		return handler(ctx, llmCtx)
	}
}
