# Architecture Overview

This document explains the architecture of go-toolbox and how it compares to the TypeScript version.

## Core Concepts

### 1. Describable Interface

The `Describable[Input, Output]` interface is the foundation of the library. It represents a function with metadata:

```go
type Describable[Input, Output any] interface {
    Call(ctx context.Context, input Input) (Output, error)
    GetDescription() Description
}
```

This allows both regular functions and LLM-powered functions to be treated uniformly.

### 2. Middleware Pattern

Middlewares follow the same pattern as the TypeScript version:

```go
type LLMMiddleware[Input, Output any] func(
    ctx context.Context,
    llmCtx *LLMContext[Input, Output],
    next LLMHandler[Input, Output],
) error
```

Each middleware receives:
- `ctx`: Go context for cancellation and timeouts
- `llmCtx`: The LLM context with all state
- `next`: The next handler in the chain

### 3. LLMContext

The `LLMContext` struct contains all state for the middleware chain:

```go
type LLMContext[Input, Output any] struct {
    Description LLMDescription
    Initializer Initializer[Input, Output]
    Finalizer   Finalizer[Input, Output]
    Input       Input
    Messages    []openai.ChatCompletionMessage
    Tools       []openai.Tool
    Usage       openai.Usage
    Completion  *openai.ChatCompletionResponse
}
```

This is passed through the middleware chain and can be modified at each step.

### 4. Initializers and Finalizers

**Initializers** convert input into initial messages:

```go
type Initializer[Input, Output any] func(
    ctx context.Context,
    llmCtx *LLMContext[Input, Output],
) error
```

**Finalizers** extract output from completions:

```go
type Finalizer[Input, Output any] func(
    ctx context.Context,
    llmCtx *LLMContext[Input, Output],
) (Output, error)
```

## Comparison with TypeScript Version

### Similarities

1. **Middleware Pattern**: Both use the same composable middleware pattern
2. **Initializer/Finalizer**: Same concept for input/output transformation
3. **Built-in Middlewares**: Same set of middlewares (retry, cache, memory, logging, timeout, react, otel)
4. **ReAct Pattern**: Same implementation for tool calling

### Differences

1. **Type System**:
   - TypeScript uses Zod for runtime validation
   - Go uses generics and struct tags for type safety
   - Go provides compile-time type checking

2. **Error Handling**:
   - TypeScript uses exceptions and promises
   - Go uses explicit error returns

3. **Context Management**:
   - TypeScript passes context implicitly through the chain
   - Go uses `context.Context` explicitly for cancellation/timeouts

4. **Concurrency**:
   - Go has built-in goroutines and channels
   - Can easily add concurrent execution patterns

## Design Decisions

### 1. Go Generics

We use Go 1.22+ generics for type safety:

```go
func Describe[Input, Output any](
    desc Description,
    handler HandlerFunc[Input, Output],
) Describable[Input, Output]
```

This provides compile-time type checking while maintaining flexibility.

### 2. Interface-Based Design

Core abstractions use interfaces:

```go
type CacheStore interface {
    Get(ctx context.Context, key string) (*openai.ChatCompletionResponse, error)
    Set(ctx context.Context, key string, value *openai.ChatCompletionResponse) error
}
```

This allows for easy testing and custom implementations.

### 3. Functional Options

Middleware configuration uses the options pattern:

```go
middlewares.Memory[Input, Output](middlewares.MemoryOptions[Input, Output]{
    Store: store,
    KeyFn: keyFunc,
    MaxMessages: 50,
})
```

### 4. Context-First

All functions take `context.Context` as the first parameter, following Go conventions:

```go
func (d *llmDescribedFunc[Input, Output]) Call(ctx context.Context, input Input) (Output, error)
```

## Middleware Chain Execution

The middleware chain is built right-to-left but executes left-to-right:

```
┌─────────────┐
│   Logging   │ ← Wraps everything, logs start/end
└──────┬──────┘
       │
┌──────▼──────┐
│    Retry    │ ← Retries on failure
└──────┬──────┘
       │
┌──────▼──────┐
│    Cache    │ ← Short-circuits if cached
└──────┬──────┘
       │
┌──────▼──────┐
│  Terminal   │ ← Calls OpenAI API
└─────────────┘
```

Each middleware can:
1. Modify the context before calling `next`
2. Short-circuit by returning without calling `next`
3. Handle errors from downstream middlewares
4. Modify the result after `next` returns

## Extension Points

### Custom Middleware

Create custom middleware by implementing the signature:

```go
func MyMiddleware[Input, Output any]() toolbox.LLMMiddleware[Input, Output] {
    return func(ctx context.Context, llmCtx *toolbox.LLMContext[Input, Output], next toolbox.LLMHandler[Input, Output]) error {
        // Before logic
        err := next(ctx, llmCtx)
        // After logic
        return err
    }
}
```

### Custom Stores

Implement storage interfaces for cache or memory:

```go
type MyRedisCache struct {
    client *redis.Client
}

func (c *MyRedisCache) Get(ctx context.Context, key string) (*openai.ChatCompletionResponse, error) {
    // Implementation
}

func (c *MyRedisCache) Set(ctx context.Context, key string, value *openai.ChatCompletionResponse) error {
    // Implementation
}
```

### Custom Initializers/Finalizers

Create custom transformation logic:

```go
func CustomInitializer[Input, Output any](config Config) toolbox.Initializer[Input, Output] {
    return func(ctx context.Context, llmCtx *toolbox.LLMContext[Input, Output]) error {
        // Custom initialization logic
        return nil
    }
}
```

## Testing

The architecture supports easy testing:

1. **Mock Clients**: Inject custom OpenAI clients
2. **Mock Stores**: Use in-memory implementations for tests
3. **Middleware Testing**: Test middleware in isolation
4. **Integration Tests**: Test full chains with mock responses

Example:

```go
func TestSummarizer(t *testing.T) {
    mockClient := &MockOpenAIClient{}
    
    summarize := toolbox.DescribeLLM[Input, Output](
        toolbox.LLMDescription{
            Description: toolbox.Description{
                Name: "summarize",
                Description: "Test summarizer",
            },
            Model: "gpt-4o",
            Client: mockClient,
        },
        // ... middlewares
    )
    
    // Test
}
```

## Performance Considerations

1. **Memory**: Context is passed by pointer to avoid copying
2. **Allocation**: Middleware chain is built once per call
3. **Concurrency**: Safe for concurrent use (stateless middlewares)
4. **Caching**: Reduces API calls and improves response time

## Future Enhancements

Potential additions:

1. **Streaming Support**: Add streaming response handling
2. **Batch Processing**: Process multiple inputs concurrently
3. **Circuit Breaker**: Add circuit breaker middleware
4. **Rate Limiting**: Add rate limiting middleware
5. **Metrics**: Add Prometheus metrics middleware
6. **Schema Validation**: Add JSON schema validation
