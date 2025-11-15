package toolbox

import (
	"context"
	"encoding/json"
	"fmt"
)

// Initializer converts input context into middleware context with messages.
type Initializer[Input, Output any] func(
	ctx context.Context,
	inputCtx InputContext[Input, Output],
) (Context[Input, Output], error)

// NewInitializer creates a standard initializer with a system prompt.
func NewInitializer[Input, Output any](systemPrompt string) Initializer[Input, Output] {
	return func(ctx context.Context, inputCtx InputContext[Input, Output]) (Context[Input, Output], error) {
		// Serialize input to JSON
		inputJSON, err := json.MarshalIndent(inputCtx.Input, "", "  ")
		if err != nil {
			return Context[Input, Output]{}, fmt.Errorf("failed to serialize input: %w", err)
		}

		// Build user message
		userContent := fmt.Sprintf(
			"# %s\n%s\n%s\n%s\n",
			inputCtx.Description.Name,
			inputCtx.Description.Description,
			"--------",
			string(inputJSON),
		)

		// Create messages
		messages := []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userContent},
		}

		return Context[Input, Output]{
			InputContext: inputCtx,
			Messages:     messages,
		}, nil
	}
}
