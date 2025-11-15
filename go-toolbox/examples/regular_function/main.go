package main

import (
	"context"
	"fmt"
	"log"

	"github.com/nmnmcc/go-toolbox"
)

type AddInput struct {
	A int `json:"a"`
	B int `json:"b"`
}

type AddOutput struct {
	Sum int `json:"sum"`
}

func main() {
	// Describe a regular function (not LLM-powered)
	addNumbers := toolbox.Describe[AddInput, AddOutput](
		toolbox.Description{
			Name:        "add_numbers",
			Description: "Add two numbers together",
		},
		func(ctx context.Context, input AddInput) (AddOutput, error) {
			return AddOutput{Sum: input.A + input.B}, nil
		},
	)

	// Use the function
	ctx := context.Background()
	result, err := addNumbers.Call(ctx, AddInput{A: 5, B: 3})
	if err != nil {
		log.Fatalf("Error: %v", err)
	}

	fmt.Printf("Result: %d + %d = %d\n", 5, 3, result.Sum)

	// Get metadata
	desc := addNumbers.GetDescription()
	fmt.Printf("\nFunction: %s\n", desc.Name)
	fmt.Printf("Description: %s\n", desc.Description)
}
