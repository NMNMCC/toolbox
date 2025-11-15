# toolbox

Composable middleware for structured LLM calls with Go

[![Go Reference](https://pkg.go.dev/badge/github.com/nmnmcc/toolbox.svg)](https://pkg.go.dev/github.com/nmnmcc/toolbox)

## Introduction

`toolbox` is a Go library for building structured, type-safe LLM applications with composable middleware. It provides a functional approach to defining language model interactions with strong type safety, schema validation, and a middleware pattern inspired by web frameworks.

**Key Features:**

- **Type-safe** - Full Go generics support with automatic type inference
- **Composable** - Middleware-based architecture for building complex behaviors
- **Schema-driven** - Uses JSON schemas for runtime validation and structured outputs
- **Extensible** - Easy to create custom middlewares and initializers

## Installation

```bash
go get github.com/nmnmcc/toolbox
```

The library requires Go 1.21+ and has a dependency on `github.com/sashabaranov/go-openai`.

## Quick Start

### Describing Regular Functions

Wrap any function with metadata for use as tools:

```go
package main

import (
    "context"
    "github.com/nmnmcc/toolbox"
)

type AddInput struct {
    A int `json:"a"`
    B int `json:"b"`
}

type AddOutput struct {
    Sum int `json:"sum"`
}

func main() {
    inputSchema, _ := toolbox.NewJSONSchema[AddInput]()
    _, outputSchema := toolbox.NewJSONSchema[AddOutput]()
    
    addNumbers := toolbox.Describe(
        toolbox.Description[AddInput, AddOutput]{
            Name:        "add_numbers",
            Description: "Add two numbers together",
            Input:       inputSchema,
            Output:      outputSchema,
        },
        func(ctx context.Context, input AddInput) (AddOutput, error) {
            return AddOutput{Sum: input.A + input.B}, nil
        },
    )

    result, _ := addNumbers.Describable(context.Background(), AddInput{A: 1, B: 2})
    fmt.Println(result.Sum) // 3
}
```

### Describing LLM-Powered Functions

Create functions backed by language models with a middleware chain:

```go
package main

import (
    "context"
    "github.com/nmnmcc/toolbox"
    "github.com/nmnmcc/toolbox/middlewares"
)

type SummarizeInput struct {
    Text string `json:"text"`
}

type SummarizeOutput struct {
    Summary string `json:"summary"`
}

func main() {
    inputSchema, _ := toolbox.NewJSONSchema[SummarizeInput]()
    _, outputSchema := toolbox.NewJSONSchema[SummarizeOutput]()
    
    summarize := toolbox.DescribeLLM(
        toolbox.LanguageModelDescription[SummarizeInput, SummarizeOutput]{
            Description: toolbox.Description[SummarizeInput, SummarizeOutput]{
                Name:        "summarize",
                Description: "Summarize the provided text",
                Input:       inputSchema,
                Output:      outputSchema,
            },
            Model: "gpt-4o",
        },
        toolbox.LanguageModelImports[SummarizeInput, SummarizeOutput]{
            Initializer: toolbox.NewInitializer[SummarizeInput, SummarizeOutput](
                "You are a helpful assistant that summarizes text concisely.",
            ),
            Middlewares: []toolbox.Middleware[SummarizeInput, SummarizeOutput]{
                middlewares.Logging[SummarizeInput, SummarizeOutput](),
                middlewares.Retry[SummarizeInput, SummarizeOutput](2),
            },
            Finalizer: toolbox.NewFinalizer[SummarizeInput, SummarizeOutput](),
        },
    )

    result, _ := summarize.Describable(context.Background(), SummarizeInput{
        Text: "Long article text goes here...",
    })
    fmt.Println(result.Summary)
}
```

## Architecture

### Core Concepts

- **Description**: Metadata about a function (name, description, input/output schemas)
- **Initializer**: Converts input into initial message arrays for the LLM
- **Middleware**: Processes the context before/after LLM calls (caching, retry, logging, etc.)
- **Finalizer**: Extracts output from LLM completion responses

### Middleware Pattern

Middleware follows a pattern similar to Express.js or Koa. Each middleware receives a context and a `next` function, allowing you to:

- Inspect or modify the request context before calling the LLM
- Call `next(ctx)` to continue the chain
- Inspect or modify the completion result after the LLM call
- Short-circuit the chain by returning early (e.g., for caching)

### Middleware Interface

```go
type Middleware[Input, Output any] func(
    ctx Context[Input, Output],
    next Next[Input, Output],
) (CompletionContext[Input, Output], error)
```

## Built-in Components

### Initializers

- `NewInitializer` - Standard initializer with system prompt

### Middlewares

- `Cache` - Cache LLM responses
- `Retry` - Retry failed calls
- `Logging` - Log execution metrics
- `Timeout` - Add timeouts to requests
- `Aggregator` - Compose multiple middlewares

### Finalizers

- `NewFinalizer` - Standard JSON parser

## Creating Custom Middleware

### Example: Simple Logging Middleware

```go
func SimpleLogger[Input, Output any]() toolbox.Middleware[Input, Output] {
    return func(ctx toolbox.Context[Input, Output], next toolbox.Next[Input, Output]) (toolbox.CompletionContext[Input, Output], error) {
        fmt.Printf("[%s] Starting call\n", ctx.Description.Name)
        start := time.Now()

        result, err := next(ctx)

        elapsed := time.Since(start)
        fmt.Printf("[%s] Completed in %v\n", ctx.Description.Name, elapsed)

        return result, err
    }
}
```

### Example: Response Transformation Middleware

```go
func AddPrefix[Input, Output any](prefix string) toolbox.Middleware[Input, Output] {
    return func(ctx toolbox.Context[Input, Output], next toolbox.Next[Input, Output]) (toolbox.CompletionContext[Input, Output], error) {
        result, err := next(ctx)
        if err != nil {
            return toolbox.CompletionContext[Input, Output]{}, err
        }

        // Modify the response content
        if len(result.Completion.Choices) > 0 {
            msg := result.Completion.Choices[0].Message
            msg.Content = prefix + msg.Content
            result.Completion.Choices[0].Message = msg
        }

        return result, nil
    }
}
```

### Example: Caching Middleware

```go
func SimpleCache[Input, Output any](store map[string]toolbox.CompletionContext[Input, Output]) toolbox.Middleware[Input, Output] {
    return func(ctx toolbox.Context[Input, Output], next toolbox.Next[Input, Output]) (toolbox.CompletionContext[Input, Output], error) {
        key := fmt.Sprintf("%s:%v", ctx.Description.Name, ctx.Input)

        // Check cache
        if cached, ok := store[key]; ok {
            return cached, nil
        }

        // Call LLM and cache result
        result, err := next(ctx)
        if err != nil {
            return toolbox.CompletionContext[Input, Output]{}, err
        }

        store[key] = result
        return result, nil
    }
}
```

## Examples

See the `examples/` directory for more complete examples:

- `simple_function.go` - Basic function description
- `cached_summarizer.go` - LLM function with caching middleware

## License

LGPL-2.1-or-later
