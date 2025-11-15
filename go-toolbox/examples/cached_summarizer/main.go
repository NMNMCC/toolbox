package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/nmnmcc/go-toolbox"
	"github.com/nmnmcc/go-toolbox/middlewares"
	openai "github.com/sashabaranov/go-openai"
)

type SummarizeInput struct {
	Text string `json:"text"`
}

type SummarizeOutput struct {
	Summary string `json:"summary"`
}

func main() {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		log.Fatal("OPENAI_API_KEY environment variable not set")
	}

	client := openai.NewClient(apiKey)
	cache := middlewares.NewInMemoryCache()

	// Create a summarizer with caching
	summarize := toolbox.DescribeLLM[SummarizeInput, SummarizeOutput](
		toolbox.LLMDescription{
			Description: toolbox.Description{
				Name:        "summarize",
				Description: "Summarize text with caching",
			},
			Model:  "gpt-4o",
			Client: client,
		},
		toolbox.DefaultInitializer[SummarizeInput, SummarizeOutput](
			"You are a helpful assistant that summarizes text.",
		),
		toolbox.DefaultFinalizer[SummarizeInput, SummarizeOutput](),
		middlewares.Cache[SummarizeInput, SummarizeOutput](middlewares.CacheOptions[SummarizeInput, SummarizeOutput]{
			Store: cache,
		}),
		middlewares.Logging[SummarizeInput, SummarizeOutput](),
	)

	ctx := context.Background()
	input := SummarizeInput{
		Text: "Go is an open source programming language that makes it easy to build simple, reliable, and efficient software.",
	}

	// First call - should hit the API
	fmt.Println("First call (cache miss):")
	start := time.Now()
	result1, err := summarize.Call(ctx, input)
	if err != nil {
		log.Fatalf("Error: %v", err)
	}
	fmt.Printf("Time: %v\n", time.Since(start))
	fmt.Printf("Summary: %s\n\n", result1.Summary)

	// Second call with same input - should use cache
	fmt.Println("Second call (cache hit):")
	start = time.Now()
	result2, err := summarize.Call(ctx, input)
	if err != nil {
		log.Fatalf("Error: %v", err)
	}
	fmt.Printf("Time: %v\n", time.Since(start))
	fmt.Printf("Summary: %s\n", result2.Summary)
}
