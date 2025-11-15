package middlewares

import (
	"context"
	"encoding/json"
	"fmt"

	openai "github.com/sashabaranov/go-openai"
	"github.com/nmnmcc/go-toolbox"
)

// ReActMaxStepsError is returned when ReAct reaches max steps without completion
type ReActMaxStepsError struct {
	MaxSteps int
}

func (e *ReActMaxStepsError) Error() string {
	return fmt.Sprintf("ReAct reached maximum steps: %d", e.MaxSteps)
}

// ReActOptions contains options for the ReAct middleware
type ReActOptions struct {
	MaxSteps int
	Tools    []toolbox.Describable[any, any]
}

// React creates a middleware that implements the ReAct (Reasoning and Acting) pattern
func React[Input, Output any](opts ReActOptions) toolbox.LLMMiddleware[Input, Output] {
	// Build tools map
	toolsByName := make(map[string]toolbox.Describable[any, any])
	for _, tool := range opts.Tools {
		desc := tool.GetDescription()
		toolsByName[desc.Name] = tool
	}

	// Convert tools to OpenAI format
	tools := make([]openai.Tool, len(opts.Tools))
	for i, tool := range opts.Tools {
		desc := tool.GetDescription()
		tools[i] = openai.Tool{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        desc.Name,
				Description: desc.Description,
				Parameters:  map[string]any{}, // Simplified - in production, you'd extract from schema
			},
		}
	}

	return func(
		ctx context.Context,
		llmCtx *toolbox.LLMContext[Input, Output],
		next toolbox.LLMHandler[Input, Output],
	) error {
		// Add tools to context
		llmCtx.Tools = append(llmCtx.Tools, tools...)

		for step := 0; step < opts.MaxSteps; step++ {
			// Call LLM
			if err := next(ctx, llmCtx); err != nil {
				return err
			}

			if llmCtx.Completion == nil || len(llmCtx.Completion.Choices) == 0 {
				return fmt.Errorf("no completion choices available")
			}

			choice := llmCtx.Completion.Choices[0]
			message := choice.Message

			// Add assistant message to history
			llmCtx.Messages = append(llmCtx.Messages, message)

			// Check if there are tool calls
			if len(message.ToolCalls) == 0 {
				// No more tool calls, we're done
				return nil
			}

			// Execute tool calls
			for _, toolCall := range message.ToolCalls {
				if toolCall.Type != openai.ToolTypeFunction {
					continue
				}

				function := toolCall.Function
				tool, exists := toolsByName[function.Name]
				if !exists {
					// Tool not found
					llmCtx.Messages = append(llmCtx.Messages, openai.ChatCompletionMessage{
						Role:       openai.ChatMessageRoleTool,
						Content:    fmt.Sprintf("Error: Tool '%s' not found", function.Name),
						ToolCallID: toolCall.ID,
					})
					continue
				}

				// Parse arguments
				var args any
				if err := json.Unmarshal([]byte(function.Arguments), &args); err != nil {
					llmCtx.Messages = append(llmCtx.Messages, openai.ChatCompletionMessage{
						Role:       openai.ChatMessageRoleTool,
						Content:    fmt.Sprintf("Error: Failed to parse arguments: %v", err),
						ToolCallID: toolCall.ID,
					})
					continue
				}

				// Call the tool
				result, err := tool.Call(ctx, args)
				if err != nil {
					llmCtx.Messages = append(llmCtx.Messages, openai.ChatCompletionMessage{
						Role:       openai.ChatMessageRoleTool,
						Content:    fmt.Sprintf("Error: %v", err),
						ToolCallID: toolCall.ID,
					})
					continue
				}

				// Convert result to JSON
				resultJSON, err := json.Marshal(result)
				if err != nil {
					llmCtx.Messages = append(llmCtx.Messages, openai.ChatCompletionMessage{
						Role:       openai.ChatMessageRoleTool,
						Content:    fmt.Sprintf("Error: Failed to serialize result: %v", err),
						ToolCallID: toolCall.ID,
					})
					continue
				}

				// Add tool result to messages
				llmCtx.Messages = append(llmCtx.Messages, openai.ChatCompletionMessage{
					Role:       openai.ChatMessageRoleTool,
					Content:    string(resultJSON),
					ToolCallID: toolCall.ID,
				})
			}
		}

		return &ReActMaxStepsError{MaxSteps: opts.MaxSteps}
	}
}
