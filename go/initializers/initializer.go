package initializers

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nmnmcc/toolbox-go"
	"github.com/sashabaranov/go-openai"
)

// Initializer creates a standard initializer with a system prompt.
func Initializer[Input, Output any](
	systemPrompt string,
) toolbox.LanguageModelInitializer[Input, Output] {
	return func(
		ctx context.Context,
		inputCtx toolbox.LanguageModelInputContext[Input, Output],
	) (toolbox.LanguageModelMiddlewareContext[Input, Output], error) {
		// Serialize input to JSON for the user message
		inputJSON, err := json.MarshalIndent(inputCtx.Input, "", "  ")
		if err != nil {
			return toolbox.LanguageModelMiddlewareContext[Input, Output]{}, fmt.Errorf("failed to serialize input: %w", err)
		}

		// Build user message content
		desc := inputCtx.Description.Description // Access embedded Description
		userContent := fmt.Sprintf(
			"# %s\n\n%s\n\n%s\n\n%s\n",
			desc.Name,
			desc.Description,
			"--------",
			string(inputJSON),
		)

		// Create messages
		messages := []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: systemPrompt,
			},
			{
				Role:    openai.ChatMessageRoleUser,
				Content: userContent,
			},
		}

		return toolbox.LanguageModelMiddlewareContext[Input, Output]{
			LanguageModelInputContext: inputCtx,
			Messages:                  messages,
		}, nil
	}
}
