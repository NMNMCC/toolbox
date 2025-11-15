# go-toolbox

Composable middleware for structured LLM calls with Go

## Introduction

`go-toolbox` is a Go library for building structured, type-safe LLM applications with composable middleware. It provides a functional approach to defining language model interactions with strong type safety through generics, and a middleware pattern inspired by web frameworks.

**Key Features:**

- **Type-safe** - Full Go generics support with compile-time type checking
- **Composable** - Middleware-based architecture for building complex behaviors
- **Extensible** - Easy to create custom middlewares and initializers
- **Production-ready** - Built with Go's standard patterns and best practices
- **Zero dependencies** (except OpenAI client) - Minimal external dependencies

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [The `Describe` Function](#the-describe-function)
  - [Describing Regular Functions](#describing-regular-functions)
  - [Describing LLM-Powered Functions](#describing-llm-powered-functions)
- [Middleware System](#middleware-system)
  - [Creating Custom Middleware](#creating-custom-middleware)
- [Built-in Middlewares](#built-in-middlewares)
  - [Retry](#retry)
  - [Cache](#cache)
  - [Memory](#memory)
  - [Logging](#logging)
  - [Timeout](#timeout)
  - [ReAct](#react)
  - [OpenTelemetry](#opentelemetry)
  - [Aggregator](#aggregator)
- [Examples](#examples)
- [License](#license)

## Installation

```bash
go get github.com/nmnmcc/go-toolbox
```

## Quick Start

```go
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
    client := openai.NewClient(os.Getenv("OPENAI_API_KEY"))

    summarize := toolbox.DescribeLLM[SummarizeInput, SummarizeOutput](
        toolbox.LLMDescription{
            Description: toolbox.Description{
                Name:        "summarize",
                Description: "Summarize the provided text",
            },
            Model:  "gpt-4o",
            Client: client,
        },
        toolbox.DefaultInitializer[SummarizeInput, SummarizeOutput](
            "You are a helpful assistant that summarizes text.",
        ),
        toolbox.DefaultFinalizer[SummarizeInput, SummarizeOutput](),
        middlewares.Logging[SummarizeInput, SummarizeOutput](),
        middlewares.Retry[SummarizeInput, SummarizeOutput](3),
    )

    ctx := context.Background()
    result, err := summarize.Call(ctx, SummarizeInput{
        Text: "Your text here...",
    })
    
    if err != nil {
        log.Fatal(err)
    }
    
    fmt.Println(result.Summary)
}
```

## The `Describe` Function

The `Describe` function is the core of the library. It has two forms:

### Describing Regular Functions

Wrap any function with metadata for use as tools in ReAct agents:

```go
type AddInput struct {
    A int `json:"a"`
    B int `json:"b"`
}

type AddOutput struct {
    Sum int `json:"sum"`
}

addNumbers := toolbox.Describe[AddInput, AddOutput](
    toolbox.Description{
        Name:        "add_numbers",
        Description: "Add two numbers together",
    },
    func(ctx context.Context, input AddInput) (AddOutput, error) {
        return AddOutput{Sum: input.A + input.B}, nil
    },
)

result, err := addNumbers.Call(ctx, AddInput{A: 1, B: 2})
// result.Sum == 3
```

### Describing LLM-Powered Functions

Create functions backed by language models with a middleware chain:

```go
summarize := toolbox.DescribeLLM[SummarizeInput, SummarizeOutput](
    toolbox.LLMDescription{
        Description: toolbox.Description{
            Name:        "summarize",
            Description: "Summarize the provided text",
        },
        Model:       "gpt-4o",
        Temperature: ptr(0.7), // Helper: ptr := func(v float32) *float32 { return &v }
        Client:      client,
    },
    toolbox.DefaultInitializer[SummarizeInput, SummarizeOutput](
        "You are a helpful assistant that summarizes text concisely.",
    ),
    toolbox.DefaultFinalizer[SummarizeInput, SummarizeOutput](),
    middlewares.Logging[SummarizeInput, SummarizeOutput](),
    middlewares.Retry[SummarizeInput, SummarizeOutput](2),
)
```

## Middleware System

Middlewares in go-toolbox follow a pattern similar to HTTP middleware. Each middleware can:

- Inspect or modify the request context before calling the LLM
- Call the next handler in the chain
- Inspect or modify the completion result after the LLM call
- Short-circuit the chain by returning early (e.g., for caching)

### Creating Custom Middleware

```go
import "github.com/nmnmcc/go-toolbox"

func CustomLogging[Input, Output any]() toolbox.LLMMiddleware[Input, Output] {
    return func(
        ctx context.Context,
        llmCtx *toolbox.LLMContext[Input, Output],
        next toolbox.LLMHandler[Input, Output],
    ) error {
        log.Printf("Starting call: %s", llmCtx.Description.Name)
        
        err := next(ctx, llmCtx)
        
        if err != nil {
            log.Printf("Call failed: %v", err)
        } else {
            log.Printf("Call succeeded")
        }
        
        return err
    }
}
```

## Built-in Middlewares

### Retry

Retries failed LLM calls with exponential backoff:

```go
import "github.com/nmnmcc/go-toolbox/middlewares"

middlewares.Retry[Input, Output](3) // Retry up to 3 times
```

### Cache

Caches LLM responses to avoid redundant API calls:

```go
cache := middlewares.NewInMemoryCache()

middlewares.Cache[Input, Output](middlewares.CacheOptions[Input, Output]{
    Store: cache,
    KeyFn: func(llmCtx *toolbox.LLMContext[Input, Output]) string {
        // Custom cache key function
        return fmt.Sprintf("%s:%v", llmCtx.Description.Name, llmCtx.Input)
    },
})
```

### Memory

Maintains conversation history across multiple calls:

```go
store := middlewares.NewInMemoryStore()

middlewares.Memory[Input, Output](middlewares.MemoryOptions[Input, Output]{
    Store:       store,
    KeyFn:       middlewares.MakeSessionMemoryKeyFunc[Input, Output](func(input Input) string {
        return input.SessionID
    }),
    MaxMessages: 50,
})
```

**Example:**

```go
type ChatInput struct {
    SessionID string `json:"session_id"`
    Message   string `json:"message"`
}

type ChatOutput struct {
    Reply string `json:"reply"`
}

chat := toolbox.DescribeLLM[ChatInput, ChatOutput](
    // ... description ...
    toolbox.DefaultInitializer[ChatInput, ChatOutput]("You are a helpful assistant."),
    toolbox.DefaultFinalizer[ChatInput, ChatOutput](),
    middlewares.Memory[ChatInput, ChatOutput](middlewares.MemoryOptions[ChatInput, ChatOutput]{
        Store: memoryStore,
        KeyFn: middlewares.MakeSessionMemoryKeyFunc[ChatInput, ChatOutput](func(input ChatInput) string {
            return input.SessionID
        }),
    }),
)

// First message
chat.Call(ctx, ChatInput{SessionID: "user-123", Message: "My name is Alice"})

// Second message - remembers the name
chat.Call(ctx, ChatInput{SessionID: "user-123", Message: "What's my name?"})
// Response: "Your name is Alice"
```

### Logging

Logs execution time and token usage:

```go
// Use default console logging
middlewares.Logging[Input, Output]()

// Or provide custom logger
middlewares.Logging[Input, Output](middlewares.LoggingOptions[Input, Output]{
    Logger: func(ctx context.Context, llmCtx *toolbox.LLMContext[Input, Output], elapsed time.Duration, err error) {
        // Custom logging logic
    },
})
```

### Timeout

Adds a timeout to LLM calls:

```go
import "time"

middlewares.Timeout[Input, Output](30 * time.Second)
```

### ReAct

Implements the ReAct (Reasoning and Acting) pattern for tool-calling:

```go
type WeatherInput struct {
    Location string `json:"location"`
}

type WeatherOutput struct {
    Temperature float64 `json:"temperature"`
    Condition   string  `json:"condition"`
}

getWeather := toolbox.Describe[WeatherInput, WeatherOutput](
    toolbox.Description{
        Name:        "getWeather",
        Description: "Get weather for a location",
    },
    func(ctx context.Context, input WeatherInput) (WeatherOutput, error) {
        // Implementation
        return WeatherOutput{Temperature: 72, Condition: "sunny"}, nil
    },
)

agent := toolbox.DescribeLLM[QueryInput, QueryOutput](
    // ... description ...
    toolbox.DefaultInitializer[QueryInput, QueryOutput](
        "You are a weather assistant. Use tools to answer questions.",
    ),
    toolbox.DefaultFinalizer[QueryInput, QueryOutput](),
    middlewares.React[QueryInput, QueryOutput](middlewares.ReActOptions{
        MaxSteps: 10,
        Tools:    []toolbox.Describable[any, any]{getWeather},
    }),
)
```

### OpenTelemetry

Adds OpenTelemetry tracing for observability:

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/attribute"
)

tracer := otel.Tracer("my-app")

middlewares.OTel[Input, Output](middlewares.OTelOptions{
    Tracer: tracer,
    Attributes: []attribute.KeyValue{
        attribute.String("service", "llm-service"),
    },
})
```

### Aggregator

Combines multiple middlewares into a single middleware:

```go
standardMiddlewares := middlewares.Aggregator(
    middlewares.Logging[Input, Output](),
    middlewares.Retry[Input, Output](3),
    middlewares.Timeout[Input, Output](30*time.Second),
)

myFunction := toolbox.DescribeLLM[Input, Output](
    // ... description ...
    initializer,
    finalizer,
    standardMiddlewares,
)
```

## Examples

See the [examples/](examples/) directory for complete working examples:

- **[simple_summarizer.go](examples/simple_summarizer.go)** - Basic text summarization with LLM
- **[regular_function.go](examples/regular_function.go)** - Wrapping regular functions with metadata
- **[weather_react.go](examples/weather_react.go)** - ReAct pattern with tool calling
- **[chat_with_memory.go](examples/chat_with_memory.go)** - Stateful conversations with memory
- **[cached_summarizer.go](examples/cached_summarizer.go)** - Response caching

To run an example:

```bash
export OPENAI_API_KEY=your-api-key
cd examples
go run simple_summarizer.go
```

## Architecture

The library is structured around several core concepts:

1. **Describable** - An interface for functions with metadata
2. **Middleware** - Composable behavior wrappers
3. **Initializer** - Converts input into initial messages
4. **Finalizer** - Extracts output from LLM completions
5. **LLMContext** - Contains all state for the middleware chain

This design allows for:
- Type safety through Go generics
- Composability through middleware chaining
- Extensibility through custom implementations
- Testability through dependency injection

## Go Version Requirements

- Go 1.22 or later (requires generics support)

## Dependencies

- `github.com/sashabaranov/go-openai` - OpenAI API client
- `go.opentelemetry.io/otel` - OpenTelemetry tracing (optional)

## License

LGPL-2.1-or-later

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Acknowledgments

This library is inspired by the TypeScript version [@nmnmcc/toolbox](https://www.npmjs.com/package/@nmnmcc/toolbox).
