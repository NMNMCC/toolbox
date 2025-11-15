package middlewares

import (
	"context"
	"time"

	"github.com/nmnmcc/toolbox-go/toolbox"
)

// ShouldRetry determines whether the middleware should retry the failure.
type ShouldRetry func(err error) bool

// Retry replays the downstream chain using exponential backoff.
func Retry[I any, O any](
	attempts int,
	baseDelay time.Duration,
	shouldRetry ShouldRetry,
) toolbox.LanguageModelMiddleware[I, O] {
	if attempts <= 0 {
		attempts = 1
	}
	if shouldRetry == nil {
		shouldRetry = func(error) bool { return true }
	}

	return func(
		ctx context.Context,
		input toolbox.LanguageModelMiddlewareContext[I, O],
		next toolbox.LanguageModelMiddlewareNext[I, O],
	) (toolbox.LanguageModelCompletionContext[I, O], error) {
		var zero toolbox.LanguageModelCompletionContext[I, O]
		var lastErr error

		for attempt := 1; attempt <= attempts; attempt++ {
			result, err := next(ctx, input)
			if err == nil {
				return result, nil
			}

			lastErr = err
			if ctx.Err() != nil || attempt == attempts || !shouldRetry(err) {
				return zero, err
			}

			delay := baseDelay
			if delay > 0 {
				delay = delay * time.Duration(1<<(attempt-1))
				select {
				case <-time.After(delay):
				case <-ctx.Done():
					return zero, ctx.Err()
				}
			}
		}

		if lastErr != nil {
			return zero, lastErr
		}
		return zero, context.DeadlineExceeded
	}
}
