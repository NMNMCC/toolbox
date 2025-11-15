package toolbox

import "context"

// Message mirrors OpenAI-style chat messages but keeps the type lightweight.
type Message struct {
	Role    string
	Content string
}

// CompletionChoice represents a single model choice.
type CompletionChoice struct {
	Message Message
}

// Usage tracks token consumption.
type Usage struct {
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

// Completion is a generic container returned by LanguageModelClient implementations.
type Completion struct {
	ID      string
	Choices []CompletionChoice
	Usage   Usage
	Raw     any
}

// Tool encodes a function/tool definition for tool-enabled models.
type Tool struct {
	Name        string
	Description string
}

// CompletionRequest captures the information needed by a LanguageModelClient.
type CompletionRequest struct {
	Model       string
	Messages    []Message
	MaxTokens   int
	Temperature float32
	Tools       []Tool
	Metadata    map[string]any
}

// LanguageModelClient abstracts over concrete provider SDKs.
type LanguageModelClient interface {
	Complete(ctx context.Context, req CompletionRequest) (*Completion, error)
}

// LanguageModelDescription augments Description with model-specific fields.
type LanguageModelDescription[I any, O any] struct {
	Description[I, O]

	Model       string
	Temperature float32
	MaxTokens   int
	Metadata    map[string]any

	Client LanguageModelClient
}

// LanguageModelInitializer populates the initial middleware context.
type LanguageModelInitializer[I any, O any] func(
	ctx context.Context,
	input LanguageModelInputContext[I, O],
) (LanguageModelMiddlewareContext[I, O], error)

// LanguageModelMiddleware can inspect/modify the request/response cycle.
type LanguageModelMiddleware[I any, O any] func(
	ctx context.Context,
	input LanguageModelMiddlewareContext[I, O],
	next LanguageModelMiddlewareNext[I, O],
) (LanguageModelCompletionContext[I, O], error)

// LanguageModelMiddlewareNext is the continuation function each middleware receives.
type LanguageModelMiddlewareNext[I any, O any] func(
	ctx context.Context,
	input LanguageModelMiddlewareContext[I, O],
) (LanguageModelCompletionContext[I, O], error)

// LanguageModelFinalizer turns the completion into strongly typed output.
type LanguageModelFinalizer[I any, O any] func(
	ctx context.Context,
	input LanguageModelCompletionContext[I, O],
) (LanguageModelOutputContext[I, O], error)

// LanguageModelImports mimic the initializer/middleware/finalizer tuple from TS.
type LanguageModelImports[I any, O any] struct {
	Initializer LanguageModelInitializer[I, O]
	Middlewares []LanguageModelMiddleware[I, O]
	Finalizer   LanguageModelFinalizer[I, O]
}

// LanguageModelInputContext is passed to the initializer.
type LanguageModelInputContext[I any, O any] struct {
	Description LanguageModelDescription[I, O]

	Initializer LanguageModelInitializer[I, O]
	Middlewares []LanguageModelMiddleware[I, O]
	Finalizer   LanguageModelFinalizer[I, O]

	Usage Usage
	Input I
}

// LanguageModelMiddlewareContext is what general middlewares manipulate.
type LanguageModelMiddlewareContext[I any, O any] struct {
	LanguageModelInputContext[I, O]

	Tools    []Tool
	Messages []Message
}

// LanguageModelCompletionContext includes the raw completion response.
type LanguageModelCompletionContext[I any, O any] struct {
	LanguageModelMiddlewareContext[I, O]

	Completion *Completion
}

// LanguageModelOutputContext represents the final shape before returning to the caller.
type LanguageModelOutputContext[I any, O any] struct {
	LanguageModelCompletionContext[I, O]

	Output O
}
