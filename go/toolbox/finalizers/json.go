package finalizers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/nmnmcc/toolbox-go/toolbox"
)

var ErrContentMissing = errors.New("finalizers.JSON: completion content missing")

// JSON parses the first choice as JSON into the declared output type.
func JSON[I any, O any]() toolbox.LanguageModelFinalizer[I, O] {
	return func(
		ctx context.Context,
		input toolbox.LanguageModelCompletionContext[I, O],
	) (toolbox.LanguageModelOutputContext[I, O], error) {
		var zero toolbox.LanguageModelOutputContext[I, O]

		if input.Completion == nil || len(input.Completion.Choices) == 0 {
			return zero, ErrContentMissing
		}

		content := strings.TrimSpace(input.Completion.Choices[0].Message.Content)
		if content == "" {
			return zero, ErrContentMissing
		}

		var output O
		if err := json.Unmarshal([]byte(content), &output); err != nil {
			return zero, fmt.Errorf("finalizers.JSON: decode: %w", err)
		}

		return toolbox.LanguageModelOutputContext[I, O]{
			LanguageModelCompletionContext: input,
			Output:                         output,
		}, nil
	}
}
