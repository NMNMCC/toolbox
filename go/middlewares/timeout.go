package middlewares

import (
	"context"
	"fmt"
	"time"

	"github.com/nmnmcc/toolbox"
)

// TimeoutError is returned when a request times out.
type TimeoutError[Input, Output any] struct {
	Context toolbox.Context[Input, Output]
	Timeout time.Duration
}

func (e *TimeoutError[Input, Output]) Error() string {
	return fmt.Sprintf("timeout after %v", e.Timeout)
}

// Timeout creates a middleware that adds a timeout to LLM calls.
func Timeout[Input, Output any](timeout time.Duration) toolbox.Middleware[Input, Output] {
	return func(ctx toolbox.Context[Input, Output], next toolbox.Next[Input, Output]) (toolbox.CompletionContext[Input, Output], error) {
		// Create a context with timeout
		timeoutCtx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()

		// Channel to receive result
		resultChan := make(chan toolbox.CompletionContext[Input, Output], 1)
		errChan := make(chan error, 1)

		// Execute next middleware in goroutine
		go func() {
			result, err := next(ctx)
			if err != nil {
				errChan <- err
				return
			}
			resultChan <- result
		}()

		// Wait for result or timeout
		select {
		case result := <-resultChan:
			return result, nil
		case err := <-errChan:
			return toolbox.CompletionContext[Input, Output]{}, err
		case <-timeoutCtx.Done():
			return toolbox.CompletionContext[Input, Output]{}, &TimeoutError[Input, Output]{
				Context: ctx,
				Timeout: timeout,
			}
		}
	}
}
