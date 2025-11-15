package toolbox

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/go-playground/validator/v10"
	"github.com/sashabaranov/go-openai"
)

// Describable is a function that takes input and returns output.
type Describable[Input, Output any] func(ctx context.Context, input Input) (Output, error)

// Description contains metadata about a function.
type Description[Input, Output any] struct {
	Name        string
	Description string
	Input       Input // Used for validation schema
	Output      Output // Used for validation schema
}

// LanguageModelDescription extends Description with LLM-specific parameters.
type LanguageModelDescription[Input, Output any] struct {
	Description[Input, Output]
	Model       string
	Temperature *float32
	MaxTokens   *int
	Client      *openai.Client
}

// Described represents a function that has been described with metadata.
// It can be called directly as a function and also provides metadata access.
type Described[Input, Output any] interface {
	Call(ctx context.Context, input Input) (Output, error)
	GetDescription() Description[Input, Output]
}

// LanguageModelInitializer converts input context into middleware context.
type LanguageModelInitializer[Input, Output any] func(
	ctx context.Context,
	inputCtx LanguageModelInputContext[Input, Output],
) (LanguageModelMiddlewareContext[Input, Output], error)

// LanguageModelFinalizer extracts output from completion context.
type LanguageModelFinalizer[Input, Output any] func(
	ctx context.Context,
	completionCtx LanguageModelCompletionContext[Input, Output],
) (LanguageModelOutputContext[Input, Output], error)

// LanguageModelMiddleware processes middleware context and calls next.
type LanguageModelMiddleware[Input, Output any] Middleware[
	LanguageModelMiddlewareContext[Input, Output],
	LanguageModelCompletionContext[Input, Output],
]

// LanguageModelInputContext contains the initial input context.
type LanguageModelInputContext[Input, Output any] struct {
	Description LanguageModelDescription[Input, Output]
	Initializer LanguageModelInitializer[Input, Output]
	Middlewares []LanguageModelMiddleware[Input, Output]
	Finalizer   LanguageModelFinalizer[Input, Output]
	Usage       openai.Usage
	Input       Input
}

// LanguageModelMiddlewareContext extends input context with messages.
type LanguageModelMiddlewareContext[Input, Output any] struct {
	LanguageModelInputContext[Input, Output]
	Tools    []openai.FunctionDefinition
	Messages []openai.ChatCompletionMessage
}

// LanguageModelCompletionContext extends middleware context with completion.
type LanguageModelCompletionContext[Input, Output any] struct {
	LanguageModelMiddlewareContext[Input, Output]
	Completion openai.ChatCompletionResponse
}

// LanguageModelOutputContext extends completion context with parsed output.
type LanguageModelOutputContext[Input, Output any] struct {
	LanguageModelCompletionContext[Input, Output]
	Output Output
}

// LanguageModelImports represents the chain of initializer, middlewares, and finalizer.
type LanguageModelImports[Input, Output any] struct {
	Initializer LanguageModelInitializer[Input, Output]
	Middlewares []LanguageModelMiddleware[Input, Output]
	Finalizer   LanguageModelFinalizer[Input, Output]
}

// describedFunc implements Described interface.
type describedFunc[Input, Output any] struct {
	description Description[Input, Output]
	impl        Describable[Input, Output]
}

func (d *describedFunc[Input, Output]) GetDescription() Description[Input, Output] {
	return d.description
}

// Call implements Described interface
func (d *describedFunc[Input, Output]) Call(ctx context.Context, input Input) (Output, error) {
	return d.impl(ctx, input)
}

// Describe wraps a regular function with metadata.
func Describe[Input, Output any](
	desc Description[Input, Output],
	impl Describable[Input, Output],
) Described[Input, Output] {
	return &describedFunc[Input, Output]{
		description: desc,
		impl:        impl,
	}
}

// DescribeLLM creates an LLM-powered function with middleware chain.
func DescribeLLM[Input, Output any](
	desc LanguageModelDescription[Input, Output],
	imports LanguageModelImports[Input, Output],
) Described[Input, Output] {
	validate := validator.New()

	impl := func(callCtx context.Context, input Input) (Output, error) {
		// Validate input
		if err := validate.Struct(input); err != nil {
			var zero Output
			return zero, fmt.Errorf("input validation failed: %w", err)
		}

		// Create input context
		inputCtx := LanguageModelInputContext[Input, Output]{
			Description: desc,
			Initializer: imports.Initializer,
			Middlewares: imports.Middlewares,
			Finalizer:   imports.Finalizer,
			Usage: openai.Usage{
				PromptTokens:     0,
				CompletionTokens: 0,
				TotalTokens:      0,
			},
			Input: input,
		}

		// Build middleware chain
		chain := buildMiddlewareChain(imports.Middlewares, func(
			middlewareCtx LanguageModelMiddlewareContext[Input, Output],
		) (LanguageModelCompletionContext[Input, Output], error) {
			// This is the final handler that calls the LLM
			client := desc.Client
			if client == nil {
				// Try to create a default client from environment
				defaultClient, err := NewOpenAIClient()
				if err != nil {
					return LanguageModelCompletionContext[Input, Output]{}, fmt.Errorf("openai client not configured: %w", err)
				}
				client = defaultClient
			}

			req := openai.ChatCompletionRequest{
				Model:    desc.Model,
				Messages: middlewareCtx.Messages,
			}

			if desc.Temperature != nil {
				req.Temperature = *desc.Temperature
			}
			if desc.MaxTokens != nil {
				req.MaxTokens = *desc.MaxTokens
			}
			if len(middlewareCtx.Tools) > 0 {
				req.Tools = make([]openai.Tool, len(middlewareCtx.Tools))
				for i, tool := range middlewareCtx.Tools {
					req.Tools[i] = openai.Tool{
						Type: openai.ToolTypeFunction,
						Function: &tool,
					}
				}
			}

			completion, err := client.CreateChatCompletion(callCtx, req)
			if err != nil {
				return LanguageModelCompletionContext[Input, Output]{}, err
			}

			return LanguageModelCompletionContext[Input, Output]{
				LanguageModelMiddlewareContext: middlewareCtx,
				Completion:                     completion,
			}, nil
		})

		// Initialize
		middlewareCtx, err := imports.Initializer(callCtx, inputCtx)
		if err != nil {
			var zero Output
			return zero, fmt.Errorf("initializer failed: %w", err)
		}

		// Execute middleware chain
		completionCtx, err := chain(middlewareCtx)
		if err != nil {
			var zero Output
			return zero, fmt.Errorf("middleware chain failed: %w", err)
		}

		// Finalize
		outputCtx, err := imports.Finalizer(callCtx, completionCtx)
		if err != nil {
			var zero Output
			return zero, fmt.Errorf("finalizer failed: %w", err)
		}

		// Validate output
		if err := validate.Struct(outputCtx.Output); err != nil {
			var zero Output
			return zero, fmt.Errorf("output validation failed: %w", err)
		}

		return outputCtx.Output, nil
	}

	// Create a callable wrapper
	callable := func(callCtx context.Context, input Input) (Output, error) {
		return impl(callCtx, input)
	}

	return &describedFunc[Input, Output]{
		description: desc.Description,
		impl:        callable,
	}
}

// buildMiddlewareChain constructs the middleware chain by reducing from right to left.
func buildMiddlewareChain[Input, Output any](
	middlewares []LanguageModelMiddleware[Input, Output],
	finalHandler MiddlewareNext[LanguageModelMiddlewareContext[Input, Output], LanguageModelCompletionContext[Input, Output]],
) MiddlewareNext[LanguageModelMiddlewareContext[Input, Output], LanguageModelCompletionContext[Input, Output]] {
	// Build chain from right to left (last middleware wraps final handler)
	next := finalHandler
	for i := len(middlewares) - 1; i >= 0; i-- {
		middleware := middlewares[i]
		prevNext := next
		next = func(ctx LanguageModelMiddlewareContext[Input, Output]) (LanguageModelCompletionContext[Input, Output], error) {
			return middleware(ctx, prevNext)
		}
	}
	return next
}

// Call invokes a described function.
func Call[Input, Output any](
	ctx context.Context,
	described Described[Input, Output],
	input Input,
) (Output, error) {
	return described.Call(ctx, input)
}

// JSONParse is a helper for parsing JSON content in finalizers.
func JSONParse(content string, v any) error {
	return json.Unmarshal([]byte(content), v)
}
