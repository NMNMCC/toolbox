package main

import (
	"context"
	"fmt"

	"github.com/nmnmcc/toolbox-go"
)

// AddNumbersInput represents the input for adding numbers.
type AddNumbersInput struct {
	A int `validate:"required" json:"a"`
	B int `validate:"required" json:"b"`
}

// AddNumbersOutput represents the output of adding numbers.
type AddNumbersOutput struct {
	Sum int `json:"sum"`
}

func main() {
	ctx := context.Background()

	// Describe a regular function
	addNumbers := toolbox.Describe(
		toolbox.Description[AddNumbersInput, AddNumbersOutput]{
			Name:        "add_numbers",
			Description: "Add two numbers together",
			Input:       AddNumbersInput{},
			Output:      AddNumbersOutput{},
		},
		func(ctx context.Context, input AddNumbersInput) (AddNumbersOutput, error) {
			return AddNumbersOutput{Sum: input.A + input.B}, nil
		},
	)

	// Call the function
	result, err := toolbox.Call(ctx, addNumbers, AddNumbersInput{A: 1, B: 2})
	if err != nil {
		panic(err)
	}

	fmt.Printf("Result: %+v\n", result)
	// Output: Result: {Sum:3}
}
