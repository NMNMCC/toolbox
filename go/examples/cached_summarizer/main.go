package main

import (
	"context"
	"fmt"
	"os"

	"github.com/nmnmcc/toolbox-go"
	"github.com/nmnmcc/toolbox-go/finalizers"
	"github.com/nmnmcc/toolbox-go/initializers"
	"github.com/nmnmcc/toolbox-go/middlewares"
	"github.com/sashabaranov/go-openai"
)

// SummarizeInput represents the input for summarization.
type SummarizeInput struct {
	Text  string `validate:"required" json:"text"`
	Style string `validate:"oneof=bullet_points paragraph" json:"style"`
}

// SummarizeOutput represents the output of summarization.
type SummarizeOutput struct {
	Summary string `json:"summary"`
}

func main() {
	ctx := context.Background()

	// Get API key from environment
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		fmt.Println("Please set OPENAI_API_KEY environment variable")
		return
	}

	// Create OpenAI client
	client := openai.NewClient(apiKey)

	// Create cache store
	cacheStore := middlewares.NewMapCacheStore[SummarizeInput, SummarizeOutput]()

	// Create the LLM-powered function
	summarize := toolbox.DescribeLLM(
		toolbox.LanguageModelDescription[SummarizeInput, SummarizeOutput]{
			Description: toolbox.Description[SummarizeInput, SummarizeOutput]{
				Name:        "cached_summarize",
				Description: "Summarize text, caching results so repeated calls with the same input reuse the previous completion.",
				Input:       SummarizeInput{},
				Output:      SummarizeOutput{},
			},
			Model:  "gpt-4o",
			Client: client,
		},
		toolbox.LanguageModelImports[SummarizeInput, SummarizeOutput]{
			Initializer: initializers.Initializer[SummarizeInput, SummarizeOutput](
				"You are a summarization assistant.\n" +
					"If style is 'bullet_points', respond as a short list.\n" +
					"Otherwise respond as a compact paragraph.",
			),
			Middlewares: []toolbox.LanguageModelMiddleware[SummarizeInput, SummarizeOutput]{
				middlewares.Cache(middlewares.CacheOptions[SummarizeInput, SummarizeOutput]{
					Store: cacheStore,
				}),
				middlewares.Logging[SummarizeInput, SummarizeOutput](),
				middlewares.Retry[SummarizeInput, SummarizeOutput](1),
			},
			Finalizer: finalizers.Finalizer[SummarizeInput, SummarizeOutput](nil),
		},
	)

	// Test input
	input := SummarizeInput{
		Text:  "Tooling can help structure LLM calls with clear input/output schemas and middlewares.",
		Style: "paragraph",
	}

	// First call
	fmt.Println("First call:")
	first, err := toolbox.Call(ctx, summarize, input)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Result: %+v\n", first)

	// Second call (should be cached)
	fmt.Println("\nSecond call (cached):")
	second, err := toolbox.Call(ctx, summarize, input)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Result: %+v\n", second)

	fmt.Printf("\nCache size: %d\n", cacheStore.Size())
}
