package toolbox

import (
	"context"
	"encoding/json"
	"fmt"
)

// Finalizer extracts output from completion context.
type Finalizer[Input, Output any] func(
	ctx context.Context,
	completionCtx CompletionContext[Input, Output],
) (OutputContext[Input, Output], error)

// NewFinalizer creates a standard finalizer that parses JSON from the completion.
func NewFinalizer[Input, Output any]() Finalizer[Input, Output] {
	return func(ctx context.Context, completionCtx CompletionContext[Input, Output]) (OutputContext[Input, Output], error) {
		if len(completionCtx.Completion.Choices) == 0 {
			return OutputContext[Input, Output]{}, fmt.Errorf("no choices in completion")
		}

		content := completionCtx.Completion.Choices[0].Message.Content
		if content == "" {
			return OutputContext[Input, Output]{}, fmt.Errorf("empty content in completion")
		}

		// Parse JSON from content
		var output json.RawMessage
		if err := json.Unmarshal([]byte(content), &output); err != nil {
			// If content is not JSON, wrap it as a JSON string
			output, err = json.Marshal(content)
			if err != nil {
				return OutputContext[Input, Output]{}, fmt.Errorf("failed to parse output: %w", err)
			}
		}

		return OutputContext[Input, Output]{
			CompletionContext: completionCtx,
			Output:            output,
		}, nil
	}
}
