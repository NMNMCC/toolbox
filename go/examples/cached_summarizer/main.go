package main

import (
	"context"
	"fmt"
	"os"

	"github.com/nmnmcc/toolbox"
	"github.com/nmnmcc/toolbox/middlewares"
)

// SummarizeInput represents the input for summarization.
type SummarizeInput struct {
	Text  string `json:"text"`
	Style string `json:"style"` // "bullet_points" or "paragraph"
}

// SummarizeOutput represents the output of summarization.
type SummarizeOutput struct {
	Summary string `json:"summary"`
}

func main() {
	// Create cache store
	cacheStore := middlewares.NewMapCacheStore[SummarizeInput, SummarizeOutput]()

	// Create LLM-powered function with middleware chain
	inputSchema, _ := toolbox.NewJSONSchema[SummarizeInput]()
	_, outputSchema := toolbox.NewJSONSchema[SummarizeOutput]()
	summarize := toolbox.DescribeLLM(
		toolbox.LanguageModelDescription[SummarizeInput, SummarizeOutput]{
			Description: toolbox.Description[SummarizeInput, SummarizeOutput]{
				Name:        "cached_summarize",
				Description: "Summarize text, caching results so repeated calls with the same input reuse the previous completion.",
				Input:       inputSchema,
				Output:      outputSchema,
			},
			Model: "gpt-4o",
		},
		toolbox.LanguageModelImports[SummarizeInput, SummarizeOutput]{
			Initializer: toolbox.NewInitializer[SummarizeInput, SummarizeOutput](
				"You are a summarization assistant.\n" +
					"If style is 'bullet_points', respond as a short list.\n" +
					"Otherwise respond as a compact paragraph.",
			),
			Middlewares: []toolbox.Middleware[SummarizeInput, SummarizeOutput]{
				middlewares.Cache(middlewares.CacheOptions[SummarizeInput, SummarizeOutput]{
					Store: cacheStore,
				}),
				middlewares.Logging[SummarizeInput, SummarizeOutput](),
				middlewares.Retry[SummarizeInput, SummarizeOutput](1),
			},
			Finalizer: toolbox.NewFinalizer[SummarizeInput, SummarizeOutput](),
		},
	)

	// Check for API key
	if os.Getenv("OPENAI_API_KEY") == "" {
		fmt.Println("Warning: OPENAI_API_KEY not set. This example requires an API key.")
		return
	}

	input := SummarizeInput{
		Text:  "Tooling can help structure LLM calls with clear input/output schemas and middlewares.",
		Style: "paragraph",
	}

	// First call (will hit LLM)
	fmt.Println("Making first call...")
	first, err := summarize.Describable(context.Background(), input)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	fmt.Printf("First call result: %+v\n", first)

	// Second call (should use cache)
	fmt.Println("\nMaking second call (should use cache)...")
	second, err := summarize.Describable(context.Background(), input)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	fmt.Printf("Second call result: %+v\n", second)
}
