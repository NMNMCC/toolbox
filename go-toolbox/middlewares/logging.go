package middlewares

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/nmnmcc/go-toolbox"
)

// LogFunc is a function that logs execution details
type LogFunc[Input, Output any] func(
	ctx context.Context,
	llmCtx *toolbox.LLMContext[Input, Output],
	elapsed time.Duration,
	err error,
)

// LoggingOptions contains options for the logging middleware
type LoggingOptions[Input, Output any] struct {
	Logger LogFunc[Input, Output]
}

// defaultLogger provides a simple console logger
func defaultLogger[Input, Output any](
	ctx context.Context,
	llmCtx *toolbox.LLMContext[Input, Output],
	elapsed time.Duration,
	err error,
) {
	if err != nil {
		log.Printf("[%s] Failed after %v: %v", llmCtx.Description.Name, elapsed, err)
		return
	}

	tokens := "N/A"
	if llmCtx.Completion != nil {
		tokens = fmt.Sprintf("%d", llmCtx.Usage.TotalTokens)
	}

	log.Printf("[%s] Completed in %v (tokens: %s)", llmCtx.Description.Name, elapsed, tokens)
}

// Logging creates a middleware that logs execution metrics
func Logging[Input, Output any](opts ...LoggingOptions[Input, Output]) toolbox.LLMMiddleware[Input, Output] {
	logger := defaultLogger[Input, Output]
	if len(opts) > 0 && opts[0].Logger != nil {
		logger = opts[0].Logger
	}

	return func(
		ctx context.Context,
		llmCtx *toolbox.LLMContext[Input, Output],
		next toolbox.LLMHandler[Input, Output],
	) error {
		start := time.Now()
		err := next(ctx, llmCtx)
		elapsed := time.Since(start)

		logger(ctx, llmCtx, elapsed, err)

		return err
	}
}
