package initializers

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nmnmcc/toolbox-go/toolbox"
)

// Basic creates a system/user prompt similar to the TypeScript initializer.
func Basic[I any, O any](system string) toolbox.LanguageModelInitializer[I, O] {
	return func(
		ctx context.Context,
		input toolbox.LanguageModelInputContext[I, O],
	) (toolbox.LanguageModelMiddlewareContext[I, O], error) {
		var zero toolbox.LanguageModelMiddlewareContext[I, O]

		payload, err := json.MarshalIndent(input.Input, "", "  ")
		if err != nil {
			return zero, fmt.Errorf("initializers.Basic: encode input: %w", err)
		}

		meta := input.Description.Description

		user := fmt.Sprintf(
			"# %s\n\n%s\n\n--------\n\n%s\n",
			input.Description.Name,
			meta.Description,
			payload,
		)

		return toolbox.LanguageModelMiddlewareContext[I, O]{
			LanguageModelInputContext: input,
			Messages: []toolbox.Message{
				{Role: "system", Content: system},
				{Role: "user", Content: user},
			},
		}, nil
	}
}
