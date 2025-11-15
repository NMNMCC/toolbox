package middlewares

import (
	"context"
	"fmt"

	openai "github.com/sashabaranov/go-openai"
	"github.com/nmnmcc/go-toolbox"
)

// MemoryStore defines the interface for conversation history storage
type MemoryStore interface {
	Get(ctx context.Context, key string) ([]openai.ChatCompletionMessage, error)
	Set(ctx context.Context, key string, messages []openai.ChatCompletionMessage) error
}

// MemoryKeyFunc generates a memory key from the context
type MemoryKeyFunc[Input, Output any] func(llmCtx *toolbox.LLMContext[Input, Output]) string

// MemoryOptions contains options for the memory middleware
type MemoryOptions[Input, Output any] struct {
	Store       MemoryStore
	KeyFn       MemoryKeyFunc[Input, Output]
	MaxMessages int // Maximum number of messages to keep in history
}

// defaultMemoryKeyFn creates a default memory key function
func defaultMemoryKeyFn[Input, Output any](llmCtx *toolbox.LLMContext[Input, Output]) string {
	return llmCtx.Description.Name
}

// Memory creates a middleware that maintains conversation history
func Memory[Input, Output any](opts MemoryOptions[Input, Output]) toolbox.LLMMiddleware[Input, Output] {
	keyFn := opts.KeyFn
	if keyFn == nil {
		keyFn = defaultMemoryKeyFn[Input, Output]
	}

	maxMessages := opts.MaxMessages
	if maxMessages <= 0 {
		maxMessages = 100 // Default limit
	}

	return func(
		ctx context.Context,
		llmCtx *toolbox.LLMContext[Input, Output],
		next toolbox.LLMHandler[Input, Output],
	) error {
		key := keyFn(llmCtx)

		// Load conversation history
		history, err := opts.Store.Get(ctx, key)
		if err == nil && len(history) > 0 {
			// Prepend history to current messages
			llmCtx.Messages = append(history, llmCtx.Messages...)
		}

		// Call next handler
		if err := next(ctx, llmCtx); err != nil {
			return err
		}

		// Add assistant response to history
		if llmCtx.Completion != nil && len(llmCtx.Completion.Choices) > 0 {
			llmCtx.Messages = append(llmCtx.Messages, llmCtx.Completion.Choices[0].Message)
		}

		// Trim history if needed
		if len(llmCtx.Messages) > maxMessages {
			// Keep system message (first) and trim from the middle
			systemMsg := llmCtx.Messages[0]
			recentMsgs := llmCtx.Messages[len(llmCtx.Messages)-maxMessages+1:]
			llmCtx.Messages = append([]openai.ChatCompletionMessage{systemMsg}, recentMsgs...)
		}

		// Save updated history
		_ = opts.Store.Set(ctx, key, llmCtx.Messages)

		return nil
	}
}

// InMemoryStore is a simple in-memory conversation history store
type InMemoryStore struct {
	data map[string][]openai.ChatCompletionMessage
}

// NewInMemoryStore creates a new in-memory memory store
func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{
		data: make(map[string][]openai.ChatCompletionMessage),
	}
}

// Get retrieves conversation history from the store
func (s *InMemoryStore) Get(ctx context.Context, key string) ([]openai.ChatCompletionMessage, error) {
	if val, ok := s.data[key]; ok {
		// Return a copy to prevent external modifications
		result := make([]openai.ChatCompletionMessage, len(val))
		copy(result, val)
		return result, nil
	}
	return nil, fmt.Errorf("memory not found")
}

// Set stores conversation history in the store
func (s *InMemoryStore) Set(ctx context.Context, key string, messages []openai.ChatCompletionMessage) error {
	// Store a copy to prevent external modifications
	stored := make([]openai.ChatCompletionMessage, len(messages))
	copy(stored, messages)
	s.data[key] = stored
	return nil
}

// MakeSessionMemoryKeyFunc creates a memory key function that uses a session ID from input
func MakeSessionMemoryKeyFunc[Input, Output any](extractSessionID func(Input) string) MemoryKeyFunc[Input, Output] {
	return func(llmCtx *toolbox.LLMContext[Input, Output]) string {
		sessionID := extractSessionID(llmCtx.Input)
		return fmt.Sprintf("%s:%s", llmCtx.Description.Name, sessionID)
	}
}
