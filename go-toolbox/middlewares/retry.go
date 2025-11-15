package middlewares

import (
	"context"

	"github.com/nmnmcc/go-toolbox"
)

// Retry creates a middleware that retries failed LLM calls
func Retry[Input, Output any](maxRetries int) toolbox.LLMMiddleware[Input, Output] {
	return func(
		ctx context.Context,
		llmCtx *toolbox.LLMContext[Input, Output],
		next toolbox.LLMHandler[Input, Output],
	) error {
		var lastErr error
		for i := 0; i < maxRetries; i++ {
			err := next(ctx, llmCtx)
			if err == nil {
				return nil
			}
			lastErr = err
		}
		return lastErr
	}
}
