package finalizers

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nmnmcc/toolbox-go"
)

// FinalizerContentNotFoundError is returned when completion content is missing.
type FinalizerContentNotFoundError[Input, Output any] struct {
	Context toolbox.LanguageModelCompletionContext[Input, Output]
}

func (e *FinalizerContentNotFoundError[Input, Output]) Error() string {
	return "finalizer: content not found in completion"
}

// Finalizer creates a standard finalizer that parses JSON from completion content.
func Finalizer[Input, Output any](
	parse func(content string, v any) error,
) toolbox.LanguageModelFinalizer[Input, Output] {
	if parse == nil {
		parse = func(content string, v any) error {
			return json.Unmarshal([]byte(content), v)
		}
	}

	return func(
		ctx context.Context,
		completionCtx toolbox.LanguageModelCompletionContext[Input, Output],
	) (toolbox.LanguageModelOutputContext[Input, Output], error) {
		// Extract content from completion
		if len(completionCtx.Completion.Choices) == 0 {
			return toolbox.LanguageModelOutputContext[Input, Output]{}, &FinalizerContentNotFoundError[Input, Output]{
				Context: completionCtx,
			}
		}

		message := completionCtx.Completion.Choices[0].Message
		if message.Content == "" {
			return toolbox.LanguageModelOutputContext[Input, Output]{}, &FinalizerContentNotFoundError[Input, Output]{
				Context: completionCtx,
			}
		}

		// Parse output
		var output Output
		if err := parse(message.Content, &output); err != nil {
			return toolbox.LanguageModelOutputContext[Input, Output]{}, fmt.Errorf("failed to parse output: %w", err)
		}

		return toolbox.LanguageModelOutputContext[Input, Output]{
			LanguageModelCompletionContext: completionCtx,
			Output:                         output,
		}, nil
	}
}
