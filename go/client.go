package toolbox

import (
	"context"
	"fmt"
	"os"

	openai "github.com/sashabaranov/go-openai"
)

// OpenAIClient wraps the OpenAI client for LLM calls.
type OpenAIClient struct {
	client *openai.Client
}

// DefaultClient creates a new OpenAI client using environment variables.
func DefaultClient() *OpenAIClient {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		// Return a client that will fail on first use
		// This allows the library to be used without immediate API key requirement
		return &OpenAIClient{
			client: openai.NewClient(""),
		}
	}
	return &OpenAIClient{
		client: openai.NewClient(apiKey),
	}
}

// NewClient creates a new OpenAI client with a custom API key.
func NewClient(apiKey string) *OpenAIClient {
	return &OpenAIClient{
		client: openai.NewClient(apiKey),
	}
}

// CreateChatCompletion makes a chat completion request to OpenAI.
func CreateChatCompletion[Input, Output any](
	c *OpenAIClient,
	ctx context.Context,
	middlewareCtx Context[Input, Output],
	desc LanguageModelDescription[Input, Output],
) (ChatCompletion, error) {
	// Convert messages
	messages := make([]openai.ChatCompletionMessage, len(middlewareCtx.Messages))
	for i, msg := range middlewareCtx.Messages {
		messages[i] = openai.ChatCompletionMessage{
			Role:    msg.Role,
			Content: msg.Content,
		}
	}

	// Convert tools if present
	var tools []openai.Tool
	if len(middlewareCtx.Tools) > 0 {
		tools = make([]openai.Tool, len(middlewareCtx.Tools))
		for i, tool := range middlewareCtx.Tools {
			tools[i] = openai.Tool{
				Type: openai.ToolTypeFunction,
				Function: &openai.FunctionDefinition{
					Name:        tool.Function.Name,
					Description: tool.Function.Description,
					Parameters:  tool.Function.Parameters,
				},
			}
		}
	}

	// Build request
	req := openai.ChatCompletionRequest{
		Model:    desc.Model,
		Messages: messages,
		Tools:    tools,
	}

	if desc.Temperature != nil {
		req.Temperature = *desc.Temperature
	}
	if desc.MaxTokens != nil {
		req.MaxTokens = *desc.MaxTokens
	}

	// Make request
	resp, err := c.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return ChatCompletion{}, fmt.Errorf("openai API error: %w", err)
	}

	// Convert response
	choices := make([]Choice, len(resp.Choices))
	for i, choice := range resp.Choices {
		choices[i] = Choice{
			Message: Message{
				Role:    choice.Message.Role,
				Content: choice.Message.Content,
			},
		}
	}

	return ChatCompletion{
		ID:      resp.ID,
		Choices: choices,
		Usage: Usage{
			CompletionTokens: resp.Usage.CompletionTokens,
			PromptTokens:     resp.Usage.PromptTokens,
			TotalTokens:      resp.Usage.TotalTokens,
		},
	}, nil
}
