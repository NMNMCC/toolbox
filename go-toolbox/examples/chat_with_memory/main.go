package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/nmnmcc/go-toolbox"
	"github.com/nmnmcc/go-toolbox/middlewares"
	openai "github.com/sashabaranov/go-openai"
)

type ChatInput struct {
	SessionID string `json:"session_id"`
	Message   string `json:"message"`
}

type ChatOutput struct {
	Reply string `json:"reply"`
}

func main() {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		log.Fatal("OPENAI_API_KEY environment variable not set")
	}

	client := openai.NewClient(apiKey)
	memoryStore := middlewares.NewInMemoryStore()

	// Create a chat function with memory
	chat := toolbox.DescribeLLM[ChatInput, ChatOutput](
		toolbox.LLMDescription{
			Description: toolbox.Description{
				Name:        "chat",
				Description: "Chat with the assistant with conversation memory",
			},
			Model:  "gpt-4o",
			Client: client,
		},
		toolbox.DefaultInitializer[ChatInput, ChatOutput](
			"You are a helpful assistant. Remember previous messages in the conversation.",
		),
		toolbox.DefaultFinalizer[ChatInput, ChatOutput](),
		middlewares.Memory[ChatInput, ChatOutput](middlewares.MemoryOptions[ChatInput, ChatOutput]{
			Store: memoryStore,
			KeyFn: middlewares.MakeSessionMemoryKeyFunc[ChatInput, ChatOutput](func(input ChatInput) string {
				return input.SessionID
			}),
			MaxMessages: 50,
		}),
		middlewares.Logging[ChatInput, ChatOutput](),
	)

	ctx := context.Background()

	// First message
	result1, err := chat.Call(ctx, ChatInput{
		SessionID: "user-123",
		Message:   "My name is Alice",
	})
	if err != nil {
		log.Fatalf("Error: %v", err)
	}
	fmt.Printf("Assistant: %s\n\n", result1.Reply)

	// Second message - should remember the name
	result2, err := chat.Call(ctx, ChatInput{
		SessionID: "user-123",
		Message:   "What's my name?",
	})
	if err != nil {
		log.Fatalf("Error: %v", err)
	}
	fmt.Printf("Assistant: %s\n", result2.Reply)
}
