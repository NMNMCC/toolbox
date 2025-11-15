package middlewares

import (
	"context"
	"time"

	"github.com/nmnmcc/toolbox-go/toolbox"
)

// Timeout enforces an upper bound for downstream execution.
func Timeout[I any, O any](duration time.Duration) toolbox.LanguageModelMiddleware[I, O] {
	if duration <= 0 {
		panic("middlewares.Timeout: duration must be positive")
	}

	return func(
		ctx context.Context,
		input toolbox.LanguageModelMiddlewareContext[I, O],
		next toolbox.LanguageModelMiddlewareNext[I, O],
	) (toolbox.LanguageModelCompletionContext[I, O], error) {
		ctx, cancel := context.WithTimeout(ctx, duration)
		defer cancel()
		return next(ctx, input)
	}
}
