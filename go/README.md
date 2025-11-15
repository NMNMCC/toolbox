# toolbox-go

Composable middleware for structured LLM calls with Go

## Introduction

`toolbox-go` is a Go library for building structured, type-safe LLM applications with composable middleware. It provides a functional approach to defining language model interactions with strong type safety, schema validation, and a middleware pattern inspired by web frameworks.

**Key Features:**

- **Type-safe** - Full Go generics support with automatic type inference
- **Composable** - Middleware-based architecture for building complex behaviors
- **Schema-driven** - Uses struct tags and validation for structured inputs/outputs
- **Extensible** - Easy to create custom middlewares and initializers

## Installation

```bash
go get github.com/nmnmcc/toolbox-go
```

## Requirements

- Go 1.21 or later
- OpenAI API key (for LLM-powered functions)

## The `Describe` Function

The `Describe` function is the core of the library. It has two forms:

### Describing Regular Functions

Wrap any function with metadata for use as tools:

```go
package main

import (
    "context"
    "github.com/nmnmcc/toolbox-go"
)

type AddNumbersInput struct {
    A int `validate:"required" json:"a"`
    B int `validate:"required" json:"b"`
}

type AddNumbersOutput struct {
    Sum int `json:"sum"`
}

func main() {
    ctx := context.Background()
    
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
    
    result, err := toolbox.Call(ctx, addNumbers, AddNumbersInput{A: 1, B: 2})
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Sum: %d\n", result.Sum) // Sum: 3
}
```

### Describing LLM-Powered Functions

Create functions backed by language models with a middleware chain:

```go
package main

import (
    "context"
    "os"
    
    "github.com/nmnmcc/toolbox-go"
    "github.com/nmnmcc/toolbox-go/finalizers"
    "github.com/nmnmcc/toolbox-go/initializers"
    "github.com/nmnmcc/toolbox-go/middlewares"
    "github.com/sashabaranov/go-openai"
)

type SummarizeInput struct {
    Text  string `validate:"required" json:"text"`
    Style string `validate:"oneof=bullet_points paragraph" json:"style"`
}

type SummarizeOutput struct {
    Summary string `json:"summary"`
}

func main() {
    ctx := context.Background()
    client := openai.NewClient(os.Getenv("OPENAI_API_KEY"))
    
    summarize := toolbox.DescribeLLM(
        toolbox.LanguageModelDescription[SummarizeInput, SummarizeOutput]{
            Description: toolbox.Description[SummarizeInput, SummarizeOutput]{
                Name:        "summarize",
                Description: "Summarize the provided text",
                Input:       SummarizeInput{},
                Output:      SummarizeOutput{},
            },
            Model:  "gpt-4o",
            Client: client,
        },
        toolbox.LanguageModelImports[SummarizeInput, SummarizeOutput]{
            Initializer: initializers.Initializer[SummarizeInput, SummarizeOutput](
                "You are a helpful assistant that summarizes text concisely.",
            ),
            Middlewares: []toolbox.LanguageModelMiddleware[SummarizeInput, SummarizeOutput]{
                middlewares.Logging[SummarizeInput, SummarizeOutput](),
                middlewares.Retry[SummarizeInput, SummarizeOutput](2),
            },
            Finalizer: finalizers.Finalizer[SummarizeInput, SummarizeOutput](nil),
        },
    )
    
    result, err := toolbox.Call(ctx, summarize, SummarizeInput{
        Text:  "Long article text goes here...",
        Style: "paragraph",
    })
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Summary: %s\n", result.Summary)
}
```

## Extending the Library

The library is designed to be extended with custom middleware. This section explains how to create your own middleware to add custom behavior to your LLM calls.

### Creating Custom Middleware

Middleware in this library follows a pattern similar to Express.js or Koa. Each middleware is a function that receives a context and a `next` function, allowing you to:

- Inspect or modify the request context before calling the LLM
- Call `next(ctx)` to continue the chain
- Inspect or modify the completion result after the LLM call
- Short-circuit the chain by returning early (e.g., for caching)

### Middleware Interface

```go
type LanguageModelMiddleware[Input, Output any] func(
    ctx LanguageModelMiddlewareContext[Input, Output],
    next MiddlewareNext[LanguageModelMiddlewareContext[Input, Output], LanguageModelCompletionContext[Input, Output]],
) (LanguageModelCompletionContext[Input, Output], error)
```

### Custom Middleware Examples

#### Example 1: Simple Logging Middleware

```go
func simpleLogger[Input, Output any]() toolbox.LanguageModelMiddleware[Input, Output] {
    return func(
        ctx toolbox.LanguageModelMiddlewareContext[Input, Output],
        next toolbox.MiddlewareNext[toolbox.LanguageModelMiddlewareContext[Input, Output], toolbox.LanguageModelCompletionContext[Input, Output]],
    ) (toolbox.LanguageModelCompletionContext[Input, Output], error) {
        fmt.Printf("[%s] Starting call\n", ctx.Description.Name)
        start := time.Now()
        
        result, err := next(ctx)
        
        elapsed := time.Since(start)
        fmt.Printf("[%s] Completed in %v\n", ctx.Description.Name, elapsed)
        
        return result, err
    }
}
```

#### Example 2: Response Transformation Middleware

```go
func addPrefix[Input, Output any](prefix string) toolbox.LanguageModelMiddleware[Input, Output] {
    return func(
        ctx toolbox.LanguageModelMiddlewareContext[Input, Output],
        next toolbox.MiddlewareNext[toolbox.LanguageModelMiddlewareContext[Input, Output], toolbox.LanguageModelCompletionContext[Input, Output]],
    ) (toolbox.LanguageModelCompletionContext[Input, Output], error) {
        result, err := next(ctx)
        if err != nil {
            return result, err
        }
        
        // Modify the response content
        if len(result.Completion.Choices) > 0 {
            message := &result.Completion.Choices[0].Message
            if message.Content != nil {
                *message.Content = prefix + *message.Content
            }
        }
        
        return result, nil
    }
}
```

#### Example 3: Caching Middleware

See `middlewares/cache.go` for a complete implementation.

## Built-in Components

This library comes with several built-in components to help you get started quickly:

### Initializers

- `initializers.Initializer` - Standard initializer with system prompt

### Middlewares

- `middlewares.Cache` - Cache LLM responses
- `middlewares.Retry` - Retry failed calls
- `middlewares.Logging` - Log execution metrics

### Finalizers

- `finalizers.Finalizer` - Standard JSON parser

## Examples

See the `examples/` directory for complete working examples:

- `simple_function.go` - Basic function description
- `cached_summarizer.go` - LLM function with caching

## License

LGPL-2.1-or-later
