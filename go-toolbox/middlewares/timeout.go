package middlewares

import (
	"context"
	"fmt"
	"time"

	"github.com/nmnmcc/go-toolbox"
)

// TimeoutError is returned when an operation exceeds its timeout
type TimeoutError struct {
	Duration time.Duration
}

func (e *TimeoutError) Error() string {
	return fmt.Sprintf("operation timed out after %v", e.Duration)
}

// Timeout creates a middleware that adds a timeout to LLM calls
func Timeout[Input, Output any](duration time.Duration) toolbox.LLMMiddleware[Input, Output] {
	return func(
		ctx context.Context,
		llmCtx *toolbox.LLMContext[Input, Output],
		next toolbox.LLMHandler[Input, Output],
	) error {
		ctx, cancel := context.WithTimeout(ctx, duration)
		defer cancel()

		errChan := make(chan error, 1)

		go func() {
			errChan <- next(ctx, llmCtx)
		}()

		select {
		case err := <-errChan:
			return err
		case <-ctx.Done():
			return &TimeoutError{Duration: duration}
		}
	}
}
