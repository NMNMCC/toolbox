package toolbox

import (
	"context"
	"errors"
	"fmt"
)

var ErrMissingLanguageModelClient = errors.New("toolbox: language model client is nil")

// DescribeLLM wires a description, initializer, middleware stack, and finalizer
// into a single described function that calls a language model.
func DescribeLLM[I any, O any](
	desc LanguageModelDescription[I, O],
	imports LanguageModelImports[I, O],
) Described[I, O] {
	if desc.Model == "" {
		panic("toolbox: LanguageModelDescription must define Model")
	}
	if imports.Initializer == nil {
		panic("toolbox: LanguageModelImports.Initializer cannot be nil")
	}
	if imports.Finalizer == nil {
		panic("toolbox: LanguageModelImports.Finalizer cannot be nil")
	}

	handler := func(ctx context.Context, input I) (O, error) {
		var zero O

		if err := runValidator(ctx, input, desc.ValidateInput, "input"); err != nil {
			return zero, err
		}

		if desc.Client == nil {
			return zero, ErrMissingLanguageModelClient
		}

		baseCtx := LanguageModelInputContext[I, O]{
			Description: desc,

			Initializer: imports.Initializer,
			Middlewares: append([]LanguageModelMiddleware[I, O](nil), imports.Middlewares...),
			Finalizer:   imports.Finalizer,

			Usage: Usage{},
			Input: input,
		}

		initialCtx, err := imports.Initializer(ctx, baseCtx)
		if err != nil {
			return zero, fmt.Errorf("toolbox: initializer failed: %w", err)
		}

		next := buildChain(desc, imports.Middlewares)

		completionCtx, err := next(ctx, initialCtx)
		if err != nil {
			return zero, err
		}

		outputCtx, err := imports.Finalizer(ctx, completionCtx)
		if err != nil {
			return zero, fmt.Errorf("toolbox: finalizer failed: %w", err)
		}

		if err := runValidator(ctx, outputCtx.Output, desc.ValidateOutput, "output"); err != nil {
			return zero, err
		}

		return outputCtx.Output, nil
	}

	return Described[I, O]{
		Description:   desc.Description,
		handler:       handler,
		lmDescription: &desc,
	}
}

func buildChain[I any, O any](
	desc LanguageModelDescription[I, O],
	middlewares []LanguageModelMiddleware[I, O],
) LanguageModelMiddlewareNext[I, O] {
	tail := func(
		ctx context.Context,
		input LanguageModelMiddlewareContext[I, O],
	) (LanguageModelCompletionContext[I, O], error) {
		var zero LanguageModelCompletionContext[I, O]

		if desc.Client == nil {
			return zero, ErrMissingLanguageModelClient
		}

		req := CompletionRequest{
			Model:       desc.Model,
			Messages:    append([]Message(nil), input.Messages...),
			MaxTokens:   desc.MaxTokens,
			Temperature: desc.Temperature,
			Tools:       append([]Tool(nil), input.Tools...),
			Metadata:    desc.Metadata,
		}

		completion, err := desc.Client.Complete(ctx, req)
		if err != nil {
			return zero, err
		}

		input.LanguageModelInputContext.Usage = completion.Usage

		return LanguageModelCompletionContext[I, O]{
			LanguageModelMiddlewareContext: input,
			Completion:                     completion,
		}, nil
	}

	next := tail
	for i := len(middlewares) - 1; i >= 0; i-- {
		mid := middlewares[i]
		currNext := next
		next = func(
			ctx context.Context,
			input LanguageModelMiddlewareContext[I, O],
		) (LanguageModelCompletionContext[I, O], error) {
			return mid(ctx, input, currNext)
		}
	}

	return next
}
