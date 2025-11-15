package middlewares

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nmnmcc/toolbox"
)

// CacheStore defines the interface for cache storage.
type CacheStore[Input, Output any] interface {
	Get(ctx context.Context, key string) (*toolbox.CompletionContext[Input, Output], error)
	Set(ctx context.Context, key string, value toolbox.CompletionContext[Input, Output]) error
}

// CacheKeyFn generates a cache key from context.
type CacheKeyFn[Input, Output any] func(ctx toolbox.Context[Input, Output]) string

// DefaultCacheKey generates a default cache key from function name and input.
func DefaultCacheKey[Input, Output any](ctx toolbox.Context[Input, Output]) string {
	inputJSON, _ := json.Marshal(ctx.Input)
	return fmt.Sprintf("%s:%s", ctx.Description.Name, string(inputJSON))
}

// CacheOptions configures cache middleware.
type CacheOptions[Input, Output any] struct {
	Store CacheStore[Input, Output]
	Key   CacheKeyFn[Input, Output]
}

// Cache creates a middleware that caches LLM responses.
func Cache[Input, Output any](opts CacheOptions[Input, Output]) toolbox.Middleware[Input, Output] {
	keyFn := opts.Key
	if keyFn == nil {
		keyFn = DefaultCacheKey[Input, Output]
	}

	return func(ctx toolbox.Context[Input, Output], next toolbox.Next[Input, Output]) (toolbox.CompletionContext[Input, Output], error) {
		key := keyFn(ctx)

		// Check cache
		cached, err := opts.Store.Get(context.Background(), key)
		if err == nil && cached != nil {
			return *cached, nil
		}

		// Call next middleware
		result, err := next(ctx)
		if err != nil {
			return toolbox.CompletionContext[Input, Output]{}, err
		}

		// Store in cache
		if err := opts.Store.Set(context.Background(), key, result); err != nil {
			// Log error but don't fail the request
			// In production, you might want to use a logger here
		}

		return result, nil
	}
}

// MapCacheStore is a simple in-memory cache implementation.
type MapCacheStore[Input, Output any] struct {
	store map[string]toolbox.CompletionContext[Input, Output]
}

// NewMapCacheStore creates a new in-memory cache store.
func NewMapCacheStore[Input, Output any]() *MapCacheStore[Input, Output] {
	return &MapCacheStore[Input, Output]{
		store: make(map[string]toolbox.CompletionContext[Input, Output]),
	}
}

// Get retrieves a value from the cache.
func (m *MapCacheStore[Input, Output]) Get(ctx context.Context, key string) (*toolbox.CompletionContext[Input, Output], error) {
	val, ok := m.store[key]
	if !ok {
		return nil, fmt.Errorf("cache miss")
	}
	return &val, nil
}

// Set stores a value in the cache.
func (m *MapCacheStore[Input, Output]) Set(ctx context.Context, key string, value toolbox.CompletionContext[Input, Output]) error {
	m.store[key] = value
	return nil
}
