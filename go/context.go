package toolbox

import (
	"encoding/json"
)

// Usage represents token usage statistics.
type Usage struct {
	CompletionTokens int
	PromptTokens     int
	TotalTokens      int
}

// InputContext is the initial context before middleware processing.
type InputContext[Input, Output any] struct {
	Description LanguageModelDescription[Input, Output]
	Initializer Initializer[Input, Output]
	Middlewares []Middleware[Input, Output]
	Finalizer   Finalizer[Input, Output]
	Usage       Usage
	Input       Input
}

// Context is the middleware context that flows through the chain.
type Context[Input, Output any] struct {
	InputContext[Input, Output]
	Tools    []Tool
	Messages []Message
}

// CompletionContext extends Context with the LLM completion result.
type CompletionContext[Input, Output any] struct {
	Context    Context[Input, Output]
	Completion ChatCompletion
}

// OutputContext extends CompletionContext with parsed output.
type OutputContext[Input, Output any] struct {
	CompletionContext[Input, Output]
	Output json.RawMessage
}

// Message represents a chat message.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Tool represents a function tool definition.
type Tool struct {
	Type        string                 `json:"type"`
	Function    FunctionDefinition     `json:"function"`
}

// FunctionDefinition describes a function tool.
type FunctionDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// ChatCompletion represents the response from an LLM.
type ChatCompletion struct {
	ID      string   `json:"id"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
}

// Choice represents a completion choice.
type Choice struct {
	Message Message `json:"message"`
}
