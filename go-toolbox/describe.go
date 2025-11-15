package toolbox

import (
	"context"
	"encoding/json"
	"fmt"

	openai "github.com/sashabaranov/go-openai"
)

// Description contains metadata about a function
type Description struct {
	Name        string
	Description string
}

// Describable is a function with attached metadata
type Describable[Input, Output any] interface {
	// Call invokes the function with the given input
	Call(ctx context.Context, input Input) (Output, error)

	// GetDescription returns the function's metadata
	GetDescription() Description
}

// describedFunc is an implementation of Describable for regular functions
type describedFunc[Input, Output any] struct {
	description Description
	handler     HandlerFunc[Input, Output]
}

func (d *describedFunc[Input, Output]) Call(ctx context.Context, input Input) (Output, error) {
	return d.handler(ctx, input)
}

func (d *describedFunc[Input, Output]) GetDescription() Description {
	return d.description
}

// Describe wraps a regular function with metadata
func Describe[Input, Output any](
	desc Description,
	handler HandlerFunc[Input, Output],
) Describable[Input, Output] {
	return &describedFunc[Input, Output]{
		description: desc,
		handler:     handler,
	}
}

// LLMDescription extends Description with LLM-specific configuration
type LLMDescription struct {
	Description
	Model       string
	Temperature *float32
	MaxTokens   *int
	Client      *openai.Client
}

// LLMContext contains all the information needed for LLM middleware chain
type LLMContext[Input, Output any] struct {
	Description LLMDescription
	Initializer Initializer[Input, Output]
	Finalizer   Finalizer[Input, Output]
	Input       Input
	Messages    []openai.ChatCompletionMessage
	Tools       []openai.Tool
	Usage       openai.Usage
	Completion  *openai.ChatCompletionResponse
}

// llmDescribedFunc implements Describable for LLM-powered functions
type llmDescribedFunc[Input, Output any] struct {
	description LLMDescription
	initializer Initializer[Input, Output]
	middlewares []LLMMiddleware[Input, Output]
	finalizer   Finalizer[Input, Output]
}

func (d *llmDescribedFunc[Input, Output]) Call(ctx context.Context, input Input) (Output, error) {
	// Create initial context
	llmCtx := &LLMContext[Input, Output]{
		Description: d.description,
		Initializer: d.initializer,
		Finalizer:   d.finalizer,
		Input:       input,
		Usage:       openai.Usage{},
	}

	// Run initializer
	if err := d.initializer(ctx, llmCtx); err != nil {
		var zero Output
		return zero, fmt.Errorf("initializer failed: %w", err)
	}

	// Build middleware chain
	handler := d.buildTerminalHandler()
	for i := len(d.middlewares) - 1; i >= 0; i-- {
		mw := d.middlewares[i]
		prevHandler := handler
		handler = func(ctx context.Context, llmCtx *LLMContext[Input, Output]) error {
			return mw(ctx, llmCtx, prevHandler)
		}
	}

	// Execute chain
	if err := handler(ctx, llmCtx); err != nil {
		var zero Output
		return zero, fmt.Errorf("middleware chain failed: %w", err)
	}

	// Run finalizer
	output, err := d.finalizer(ctx, llmCtx)
	if err != nil {
		var zero Output
		return zero, fmt.Errorf("finalizer failed: %w", err)
	}

	return output, nil
}

func (d *llmDescribedFunc[Input, Output]) GetDescription() Description {
	return d.description.Description
}

// buildTerminalHandler creates the final handler that calls OpenAI API
func (d *llmDescribedFunc[Input, Output]) buildTerminalHandler() LLMHandler[Input, Output] {
	return func(ctx context.Context, llmCtx *LLMContext[Input, Output]) error {
		client := d.description.Client
		if client == nil {
			client = openai.NewClient("")
		}

		// Convert messages to API format
		messages := make([]openai.ChatCompletionMessage, len(llmCtx.Messages))
		copy(messages, llmCtx.Messages)

		req := openai.ChatCompletionRequest{
			Model:    d.description.Model,
			Messages: messages,
		}

		if d.description.Temperature != nil {
			req.Temperature = *d.description.Temperature
		}

		if d.description.MaxTokens != nil {
			req.MaxTokens = *d.description.MaxTokens
		}

		if len(llmCtx.Tools) > 0 {
			req.Tools = llmCtx.Tools
		}

		resp, err := client.CreateChatCompletion(ctx, req)
		if err != nil {
			return fmt.Errorf("openai api call failed: %w", err)
		}

		llmCtx.Completion = &resp
		if resp.Usage.TotalTokens > 0 {
			llmCtx.Usage = resp.Usage
		}

		return nil
	}
}

// DescribeLLM creates an LLM-powered function with middleware chain
func DescribeLLM[Input, Output any](
	desc LLMDescription,
	initializer Initializer[Input, Output],
	finalizer Finalizer[Input, Output],
	middlewares ...LLMMiddleware[Input, Output],
) Describable[Input, Output] {
	return &llmDescribedFunc[Input, Output]{
		description: desc,
		initializer: initializer,
		middlewares: middlewares,
		finalizer:   finalizer,
	}
}

// Initializer converts input into initial messages
type Initializer[Input, Output any] func(ctx context.Context, llmCtx *LLMContext[Input, Output]) error

// Finalizer extracts output from completion
type Finalizer[Input, Output any] func(ctx context.Context, llmCtx *LLMContext[Input, Output]) (Output, error)

// LLMMiddleware is middleware for LLM calls
type LLMMiddleware[Input, Output any] func(
	ctx context.Context,
	llmCtx *LLMContext[Input, Output],
	next LLMHandler[Input, Output],
) error

// LLMHandler is the function signature for LLM handlers
type LLMHandler[Input, Output any] func(context.Context, *LLMContext[Input, Output]) error

// Helper to create default initializer with system prompt
func DefaultInitializer[Input, Output any](systemPrompt string) Initializer[Input, Output] {
	return func(ctx context.Context, llmCtx *LLMContext[Input, Output]) error {
		// Serialize input as JSON
		inputJSON, err := json.MarshalIndent(llmCtx.Input, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal input: %w", err)
		}

		llmCtx.Messages = []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: systemPrompt,
			},
			{
				Role: openai.ChatMessageRoleUser,
				Content: fmt.Sprintf("# %s\n\n%s\n\n--------\n\n%s\n",
					llmCtx.Description.Name,
					llmCtx.Description.Description,
					string(inputJSON)),
			},
		}

		return nil
	}
}

// Helper to create default finalizer that parses JSON
func DefaultFinalizer[Input, Output any]() Finalizer[Input, Output] {
	return func(ctx context.Context, llmCtx *LLMContext[Input, Output]) (Output, error) {
		var output Output

		if llmCtx.Completion == nil {
			return output, fmt.Errorf("no completion available")
		}

		if len(llmCtx.Completion.Choices) == 0 {
			return output, fmt.Errorf("no completion choices available")
		}

		content := llmCtx.Completion.Choices[0].Message.Content
		if content == "" {
			return output, fmt.Errorf("completion content is empty")
		}

		if err := json.Unmarshal([]byte(content), &output); err != nil {
			return output, fmt.Errorf("failed to parse completion: %w", err)
		}

		return output, nil
	}
}
