package middlewares

import (
	"context"
	"log"
	"time"

	"github.com/nmnmcc/toolbox-go/toolbox"
)

// Logger is satisfied by *log.Logger and testing loggers.
type Logger interface {
	Printf(format string, args ...any)
}

// Logging writes basic lifecycle information for each call.
func Logging[I any, O any](logger Logger) toolbox.LanguageModelMiddleware[I, O] {
	if logger == nil {
		logger = log.Default()
	}

	return func(
		ctx context.Context,
		input toolbox.LanguageModelMiddlewareContext[I, O],
		next toolbox.LanguageModelMiddlewareNext[I, O],
	) (toolbox.LanguageModelCompletionContext[I, O], error) {
		start := time.Now()
		name := input.Description.Name
		logger.Printf("[%s] starting language model call", name)

		result, err := next(ctx, input)
		elapsed := time.Since(start)

		if err != nil {
			logger.Printf("[%s] failed after %s: %v", name, elapsed, err)
			return result, err
		}

		logger.Printf(
			"[%s] completed in %s (prompt=%d, completion=%d)",
			name,
			elapsed,
			result.Completion.Usage.PromptTokens,
			result.Completion.Usage.CompletionTokens,
		)

		return result, nil
	}
}
