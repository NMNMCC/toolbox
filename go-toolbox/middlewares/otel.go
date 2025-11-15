package middlewares

import (
	"context"
	"fmt"

	"github.com/nmnmcc/go-toolbox"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// OTelOptions contains options for OpenTelemetry tracing
type OTelOptions struct {
	Tracer     trace.Tracer
	Attributes []attribute.KeyValue
}

// OTel creates a middleware that adds OpenTelemetry tracing
func OTel[Input, Output any](opts OTelOptions) toolbox.LLMMiddleware[Input, Output] {
	return func(
		ctx context.Context,
		llmCtx *toolbox.LLMContext[Input, Output],
		next toolbox.LLMHandler[Input, Output],
	) error {
		spanName := fmt.Sprintf("llm.%s", llmCtx.Description.Name)
		ctx, span := opts.Tracer.Start(ctx, spanName)
		defer span.End()

		// Add base attributes
		attrs := []attribute.KeyValue{
			attribute.String("llm.function", llmCtx.Description.Name),
			attribute.String("llm.model", llmCtx.Description.Model),
		}

		// Add custom attributes
		attrs = append(attrs, opts.Attributes...)
		span.SetAttributes(attrs...)

		// Execute next handler
		err := next(ctx, llmCtx)

		// Add token usage attributes
		if llmCtx.Completion != nil {
			span.SetAttributes(
				attribute.Int("llm.tokens.prompt", llmCtx.Usage.PromptTokens),
				attribute.Int("llm.tokens.completion", llmCtx.Usage.CompletionTokens),
				attribute.Int("llm.tokens.total", llmCtx.Usage.TotalTokens),
			)
		}

		if err != nil {
			span.RecordError(err)
		}

		return err
	}
}
