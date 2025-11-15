package middlewares

import (
	"context"
	"encoding/json"
	"fmt"

	openai "github.com/sashabaranov/go-openai"
	"github.com/nmnmcc/go-toolbox"
)

// CacheStore defines the interface for cache storage
type CacheStore interface {
	Get(ctx context.Context, key string) (*openai.ChatCompletionResponse, error)
	Set(ctx context.Context, key string, value *openai.ChatCompletionResponse) error
}

// CacheKeyFunc generates a cache key from the context
type CacheKeyFunc[Input, Output any] func(llmCtx *toolbox.LLMContext[Input, Output]) string

// CacheOptions contains options for the cache middleware
type CacheOptions[Input, Output any] struct {
	Store  CacheStore
	KeyFn  CacheKeyFunc[Input, Output]
}

// defaultCacheKeyFn creates a default cache key function
func defaultCacheKeyFn[Input, Output any](llmCtx *toolbox.LLMContext[Input, Output]) string {
	inputJSON, _ := json.Marshal(llmCtx.Input)
	return fmt.Sprintf("%s:%s", llmCtx.Description.Name, string(inputJSON))
}

// Cache creates a middleware that caches LLM responses
func Cache[Input, Output any](opts CacheOptions[Input, Output]) toolbox.LLMMiddleware[Input, Output] {
	keyFn := opts.KeyFn
	if keyFn == nil {
		keyFn = defaultCacheKeyFn[Input, Output]
	}

	return func(
		ctx context.Context,
		llmCtx *toolbox.LLMContext[Input, Output],
		next toolbox.LLMHandler[Input, Output],
	) error {
		key := keyFn(llmCtx)

		// Try to get from cache
		cached, err := opts.Store.Get(ctx, key)
		if err == nil && cached != nil {
			llmCtx.Completion = cached
			return nil
		}

		// Cache miss, call next handler
		if err := next(ctx, llmCtx); err != nil {
			return err
		}

		// Store in cache
		if llmCtx.Completion != nil {
			_ = opts.Store.Set(ctx, key, llmCtx.Completion)
		}

		return nil
	}
}

// InMemoryCache is a simple in-memory cache implementation
type InMemoryCache struct {
	data map[string]*openai.ChatCompletionResponse
}

// NewInMemoryCache creates a new in-memory cache
func NewInMemoryCache() *InMemoryCache {
	return &InMemoryCache{
		data: make(map[string]*openai.ChatCompletionResponse),
	}
}

// Get retrieves a value from the cache
func (c *InMemoryCache) Get(ctx context.Context, key string) (*openai.ChatCompletionResponse, error) {
	if val, ok := c.data[key]; ok {
		return val, nil
	}
	return nil, fmt.Errorf("cache miss")
}

// Set stores a value in the cache
func (c *InMemoryCache) Set(ctx context.Context, key string, value *openai.ChatCompletionResponse) error {
	c.data[key] = value
	return nil
}
