package middlewares

import (
	"log"
	"time"

	"github.com/nmnmcc/toolbox"
)

// LoggingEvent contains information about a logged LLM call.
type LoggingEvent[Input, Output any] struct {
	Context   toolbox.Context[Input, Output]
	Result    toolbox.CompletionContext[Input, Output]
	ElapsedMs int64
}

// LoggingOptions configures logging middleware.
type LoggingOptions[Input, Output any] struct {
	Log func(event LoggingEvent[Input, Output])
}

// DefaultLog provides default logging behavior.
func DefaultLog[Input, Output any](event LoggingEvent[Input, Output]) {
	usage := event.Result.Completion.Usage
	log.Printf("llm:%s elapsed_ms=%d prompt_tokens=%d completion_tokens=%d total_tokens=%d",
		event.Context.Description.Name,
		event.ElapsedMs,
		usage.PromptTokens,
		usage.CompletionTokens,
		usage.TotalTokens,
	)
}

// Logging creates a middleware that logs LLM call metrics.
func Logging[Input, Output any](opts ...LoggingOptions[Input, Output]) toolbox.Middleware[Input, Output] {
	var options LoggingOptions[Input, Output]
	if len(opts) > 0 {
		options = opts[0]
	}
	if options.Log == nil {
		options.Log = DefaultLog[Input, Output]
	}

	return func(ctx toolbox.Context[Input, Output], next toolbox.Next[Input, Output]) (toolbox.CompletionContext[Input, Output], error) {
		start := time.Now()
		result, err := next(ctx)
		elapsed := time.Since(start)

		if err == nil {
			options.Log(LoggingEvent[Input, Output]{
				Context:   ctx,
				Result:    result,
				ElapsedMs: elapsed.Milliseconds(),
			})
		}

		return result, err
	}
}

// LoggingWithLogger creates logging middleware with a custom logger function.
func LoggingWithLogger[Input, Output any](logFn func(event LoggingEvent[Input, Output])) toolbox.Middleware[Input, Output] {
	return Logging(LoggingOptions[Input, Output]{Log: logFn})
}
