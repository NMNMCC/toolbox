package middlewares

import "github.com/nmnmcc/toolbox"

// Retry creates a middleware that retries failed LLM calls.
func Retry[Input, Output any](maxAttempts int) toolbox.Middleware[Input, Output] {
	return func(ctx toolbox.Context[Input, Output], next toolbox.Next[Input, Output]) (toolbox.CompletionContext[Input, Output], error) {
		var lastErr error
		for i := 0; i < maxAttempts; i++ {
			result, err := next(ctx)
			if err == nil {
				return result, nil
			}
			lastErr = err
		}
		return toolbox.CompletionContext[Input, Output]{}, lastErr
	}
}
