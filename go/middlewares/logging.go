package middlewares

import (
	"log"
	"time"

	"github.com/nmnmcc/toolbox-go"
)

// LoggingEvent contains information about a middleware execution.
type LoggingEvent[Input, Output any] struct {
	Context   toolbox.LanguageModelMiddlewareContext[Input, Output]
	Result    toolbox.LanguageModelCompletionContext[Input, Output]
	ElapsedMs int64
}

// LoggingOptions configures the logging middleware.
type LoggingOptions[Input, Output any] struct {
	Log func(event LoggingEvent[Input, Output]) error
}

// Logging creates a middleware that logs execution metrics.
func Logging[Input, Output any](
	options ...LoggingOptions[Input, Output],
) toolbox.LanguageModelMiddleware[Input, Output] {
	opts := LoggingOptions[Input, Output]{}
	if len(options) > 0 {
		opts = options[0]
	}

	if opts.Log == nil {
		opts.Log = defaultLog[Input, Output]
	}

	return func(
		ctx toolbox.LanguageModelMiddlewareContext[Input, Output],
		next toolbox.MiddlewareNext[toolbox.LanguageModelMiddlewareContext[Input, Output], toolbox.LanguageModelCompletionContext[Input, Output]],
	) (toolbox.LanguageModelCompletionContext[Input, Output], error) {
		startedAt := time.Now()
		result, err := next(ctx)
		elapsedMs := time.Since(startedAt).Milliseconds()

		if err != nil {
			return result, err
		}

		event := LoggingEvent[Input, Output]{
			Context:   ctx,
			Result:    result,
			ElapsedMs: elapsedMs,
		}

		if logErr := opts.Log(event); logErr != nil {
			// Log error but don't fail the request
			log.Printf("logging middleware error: %v", logErr)
		}

		return result, nil
	}
}

func defaultLog[Input, Output any](event LoggingEvent[Input, Output]) error {
	usage := event.Result.Completion.Usage
	log.Printf("llm:%s elapsed_ms=%d prompt_tokens=%d completion_tokens=%d total_tokens=%d",
		event.Context.Description.Name,
		event.ElapsedMs,
		usage.PromptTokens,
		usage.CompletionTokens,
		usage.TotalTokens,
	)
	return nil
}
