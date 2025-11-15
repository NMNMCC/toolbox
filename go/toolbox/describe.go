package toolbox

import (
	"context"
	"errors"
	"fmt"
)

// Validator validates a value in the context of Describe.
// It should return nil when the value is acceptable.
type Validator[T any] func(ctx context.Context, value T) error

// Description carries the metadata that regular described functions expose.
// Validators are optional hooks that can enforce pre/post conditions.
type Description[I any, O any] struct {
	Name        string
	Description string

	ValidateInput  Validator[I]
	ValidateOutput Validator[O]
}

// Handler is a regular business function that we can attach metadata to.
type Handler[I any, O any] func(ctx context.Context, input I) (O, error)

// Described wraps a handler with its description.
type Described[I any, O any] struct {
	Description Description[I, O]
	handler     Handler[I, O]

	lmDescription *LanguageModelDescription[I, O]
}

// Call executes the described handler with validation.
func (d Described[I, O]) Call(ctx context.Context, input I) (O, error) {
	var zero O

	if err := runValidator(ctx, input, d.Description.ValidateInput, "input"); err != nil {
		return zero, err
	}

	output, err := d.handler(ctx, input)
	if err != nil {
		return zero, err
	}

	if err := runValidator(ctx, output, d.Description.ValidateOutput, "output"); err != nil {
		return zero, err
	}

	return output, nil
}

// Handler exposes the wrapped handler for composition while keeping metadata.
func (d Described[I, O]) Handler() Handler[I, O] {
	return d.handler
}

// LanguageModel returns the language-model specific metadata when available.
func (d Described[I, O]) LanguageModel() (LanguageModelDescription[I, O], bool) {
	if d.lmDescription == nil {
		var zero LanguageModelDescription[I, O]
		return zero, false
	}
	return *d.lmDescription, true
}

// Describe annotates any function with structural metadata.
func Describe[I any, O any](desc Description[I, O], handler Handler[I, O]) Described[I, O] {
	if desc.Name == "" {
		panic("toolbox: description Name cannot be empty")
	}

	return Described[I, O]{Description: desc, handler: handler}
}

func runValidator[T any](
	ctx context.Context,
	value T,
	validator Validator[T],
	stage string,
) error {
	if validator == nil {
		return nil
	}

	if err := validator(ctx, value); err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return err
		}
		return fmt.Errorf("toolbox: %s validation failed: %w", stage, err)
	}

	return nil
}
