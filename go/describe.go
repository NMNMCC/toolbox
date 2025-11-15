package toolbox

import (
	"context"
	"fmt"
)

// Describable is a function that takes input and returns output.
type Describable[Input, Output any] func(ctx context.Context, input Input) (Output, error)

// Description contains metadata about a function.
type Description[Input, Output any] struct {
	Name        string
	Description string
	Input       InputSchema[Input]
	Output      OutputSchema[Output]
}

// LanguageModelDescription extends Description with LLM-specific parameters.
type LanguageModelDescription[Input, Output any] struct {
	Description[Input, Output]
	Model       string
	Temperature *float32
	MaxTokens   *int
	Client      *OpenAIClient
}

// Described is a function with attached description metadata.
type Described[Input, Output any] struct {
	Describable[Input, Output]
	Description[Input, Output]
}

// LanguageModelImports represents the chain of initializer, middlewares, and finalizer.
type LanguageModelImports[Input, Output any] struct {
	Initializer Initializer[Input, Output]
	Middlewares []Middleware[Input, Output]
	Finalizer   Finalizer[Input, Output]
}

// Describe wraps a regular function with description metadata.
func Describe[Input, Output any](
	desc Description[Input, Output],
	fn Describable[Input, Output],
) Described[Input, Output] {
	return Described[Input, Output]{
		Describable: fn,
		Description: desc,
	}
}

// DescribeLLM creates an LLM-powered function with middleware chain.
func DescribeLLM[Input, Output any](
	desc LanguageModelDescription[Input, Output],
	imports LanguageModelImports[Input, Output],
) Described[Input, Output] {
	return Described[Input, Output]{
		Describable: func(ctx context.Context, input Input) (Output, error) {
			// Parse and validate input
			parsedInput, err := desc.Input.Parse(input)
			if err != nil {
				var zero Output
				return zero, fmt.Errorf("input validation failed: %w", err)
			}

			// Create initial context
			inputCtx := InputContext[Input, Output]{
				Description: desc,
				Initializer: imports.Initializer,
				Middlewares: imports.Middlewares,
				Finalizer:   imports.Finalizer,
				Usage: Usage{
					CompletionTokens: 0,
					PromptTokens:     0,
					TotalTokens:      0,
				},
				Input: parsedInput,
			}

			// Run initializer to create middleware context
			middlewareCtx, err := imports.Initializer(ctx, inputCtx)
			if err != nil {
				var zero Output
				return zero, fmt.Errorf("initializer failed: %w", err)
			}

			// Build middleware chain
			chain := buildChain(imports.Middlewares, func(mwCtx Context[Input, Output]) (CompletionContext[Input, Output], error) {
				client := desc.Client
				if client == nil {
					client = DefaultClient()
				}

				// Make LLM call
				completion, err := CreateChatCompletion(client, ctx, mwCtx, desc)
				if err != nil {
					return CompletionContext[Input, Output]{}, fmt.Errorf("LLM call failed: %w", err)
				}

				return CompletionContext[Input, Output]{
					Context:    mwCtx,
					Completion: completion,
				}, nil
			})

			// Execute middleware chain
			completionCtx, err := chain(middlewareCtx)
			if err != nil {
				var zero Output
				return zero, err
			}

			// Run finalizer to extract output
			outputCtx, err := imports.Finalizer(ctx, completionCtx)
			if err != nil {
				var zero Output
				return zero, fmt.Errorf("finalizer failed: %w", err)
			}

			// Parse and validate output
			output, err := desc.Output.Parse(outputCtx.Output)
			if err != nil {
				var zero Output
				return zero, fmt.Errorf("output validation failed: %w", err)
			}

			return output, nil
		},
		Description: desc.Description,
	}
}

// buildChain constructs the middleware chain using reduceRight pattern.
func buildChain[Input, Output any](
	middlewares []Middleware[Input, Output],
	final Next[Input, Output],
) Next[Input, Output] {
	chain := final
	for i := len(middlewares) - 1; i >= 0; i-- {
		mw := middlewares[i]
		prev := chain
		chain = func(ctx Context[Input, Output]) (CompletionContext[Input, Output], error) {
			return mw(ctx, prev)
		}
	}
	return chain
}
