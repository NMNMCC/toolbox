package main

import (
	"context"
	"fmt"

	"github.com/nmnmcc/toolbox"
)

// SimpleInput represents the input for adding numbers.
type SimpleInput struct {
	A int `json:"a"`
	B int `json:"b"`
}

// SimpleOutput represents the output of adding numbers.
type SimpleOutput struct {
	Sum int `json:"sum"`
}

func main() {
	// Describe a regular function
	inputSchema, _ := toolbox.NewJSONSchema[SimpleInput]()
	_, outputSchema := toolbox.NewJSONSchema[SimpleOutput]()
	addNumbers := toolbox.Describe(
		toolbox.Description[SimpleInput, SimpleOutput]{
			Name:        "add_numbers",
			Description: "Add two numbers together",
			Input:       inputSchema,
			Output:      outputSchema,
		},
		func(ctx context.Context, input SimpleInput) (SimpleOutput, error) {
			return SimpleOutput{Sum: input.A + input.B}, nil
		},
	)

	// Use the function
	result, err := addNumbers.Describable(context.Background(), SimpleInput{A: 1, B: 2})
	if err != nil {
		panic(err)
	}

	fmt.Printf("Result: %+v\n", result)
	fmt.Printf("Function name: %s\n", addNumbers.Name)
}
