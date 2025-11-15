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

	// Create a summarizer function with LLM
	summarize := toolbox.DescribeLLM[SummarizeInput, SummarizeOutput](
		toolbox.LLMDescription{
			Description: toolbox.Description{
				Name:        "summarize",
				Description: "Summarize the provided text concisely",
			},
			Model:  "gpt-4o",
			Client: client,
		},
		toolbox.DefaultInitializer[SummarizeInput, SummarizeOutput](
			"You are a helpful assistant that summarizes text concisely.",
		),
		toolbox.DefaultFinalizer[SummarizeInput, SummarizeOutput](),
		middlewares.Logging[SummarizeInput, SummarizeOutput](),
		middlewares.Retry[SummarizeInput, SummarizeOutput](3),
	)

	// Use the summarizer
	ctx := context.Background()
	result, err := summarize.Call(ctx, SummarizeInput{
		Text: `Artificial intelligence (AI) is intelligence demonstrated by machines, 
		in contrast to the natural intelligence displayed by humans and animals. 
		Leading AI textbooks define the field as the study of "intelligent agents": 
		any device that perceives its environment and takes actions that maximize 
		its chance of successfully achieving its goals.`,
	})

	if err != nil {
		log.Fatalf("Error: %v", err)
	}

	fmt.Printf("Summary: %s\n", result.Summary)
}
