package middlewares

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nmnmcc/toolbox-go"
)

// CacheStore defines the interface for cache storage.
type CacheStore[Input, Output any] interface {
	Get(ctx context.Context, key string) (toolbox.LanguageModelCompletionContext[Input, Output], bool, error)
	Set(ctx context.Context, key string, value toolbox.LanguageModelCompletionContext[Input, Output]) error
}

// CacheKeyFn generates a cache key from context.
type CacheKeyFn[Input, Output any] func(ctx toolbox.LanguageModelMiddlewareContext[Input, Output]) string

// CacheOptions configures the cache middleware.
type CacheOptions[Input, Output any] struct {
	Store CacheStore[Input, Output]
	Key   CacheKeyFn[Input, Output]
}

// CacheMissError is returned when a cache lookup fails (but this is expected, not an error).
// This is kept for API compatibility but typically not used.
type CacheMissError[Input, Output any] struct {
	Context toolbox.LanguageModelMiddlewareContext[Input, Output]
}

func (e *CacheMissError[Input, Output]) Error() string {
	return "cache miss"
}

// Cache creates a middleware that caches LLM responses.
func Cache[Input, Output any](
	options CacheOptions[Input, Output],
) toolbox.LanguageModelMiddleware[Input, Output] {
	keyFn := options.Key
	if keyFn == nil {
		keyFn = defaultCacheKey[Input, Output]
	}

	return func(
		ctx toolbox.LanguageModelMiddlewareContext[Input, Output],
		next toolbox.MiddlewareNext[toolbox.LanguageModelMiddlewareContext[Input, Output], toolbox.LanguageModelCompletionContext[Input, Output]],
	) (toolbox.LanguageModelCompletionContext[Input, Output], error) {
		cacheKey := keyFn(ctx)

		// Try to get from cache
		cached, found, err := options.Store.Get(context.Background(), cacheKey)
		if err != nil {
			// Log error but continue
			fmt.Printf("cache get error: %v\n", err)
		}
		if found {
			return cached, nil
		}

		// Call next and cache result
		result, err := next(ctx)
		if err != nil {
			return result, err
		}

		// Store in cache
		if storeErr := options.Store.Set(context.Background(), cacheKey, result); storeErr != nil {
			// Log error but don't fail the request
			fmt.Printf("cache set error: %v\n", storeErr)
		}

		return result, nil
	}
}

func defaultCacheKey[Input, Output any](ctx toolbox.LanguageModelMiddlewareContext[Input, Output]) string {
	inputJSON, err := json.Marshal(ctx.Input)
	if err != nil {
		// Fallback to a simple key
		return fmt.Sprintf("%s:%v", ctx.Description.Name, ctx.Input)
	}
	return fmt.Sprintf("%s:%s", ctx.Description.Name, string(inputJSON))
}

// MapCacheStore is a simple in-memory cache implementation.
type MapCacheStore[Input, Output any] struct {
	store map[string]toolbox.LanguageModelCompletionContext[Input, Output]
}

// NewMapCacheStore creates a new in-memory cache store.
func NewMapCacheStore[Input, Output any]() *MapCacheStore[Input, Output] {
	return &MapCacheStore[Input, Output]{
		store: make(map[string]toolbox.LanguageModelCompletionContext[Input, Output]),
	}
}

func (m *MapCacheStore[Input, Output]) Get(
	ctx context.Context,
	key string,
) (toolbox.LanguageModelCompletionContext[Input, Output], bool, error) {
	value, found := m.store[key]
	return value, found, nil
}

func (m *MapCacheStore[Input, Output]) Set(
	ctx context.Context,
	key string,
	value toolbox.LanguageModelCompletionContext[Input, Output],
) error {
	m.store[key] = value
	return nil
}

func (m *MapCacheStore[Input, Output]) Size() int {
	return len(m.store)
}
