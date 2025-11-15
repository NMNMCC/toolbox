package middlewares

import (
	"github.com/nmnmcc/toolbox-go"
)

// Retry creates a middleware that retries failed calls up to maxAttempts times.
func Retry[Input, Output any](
	maxAttempts int,
) toolbox.LanguageModelMiddleware[Input, Output] {
	return func(
		ctx toolbox.LanguageModelMiddlewareContext[Input, Output],
		next toolbox.MiddlewareNext[toolbox.LanguageModelMiddlewareContext[Input, Output], toolbox.LanguageModelCompletionContext[Input, Output]],
	) (toolbox.LanguageModelCompletionContext[Input, Output], error) {
		var lastErr error
		for i := 0; i < maxAttempts; i++ {
			result, err := next(ctx)
			if err == nil {
				return result, nil
			}
			lastErr = err
		}
		return toolbox.LanguageModelCompletionContext[Input, Output]{}, lastErr
	}
}
