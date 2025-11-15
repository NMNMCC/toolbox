package middlewares

import (
	"context"

	"github.com/nmnmcc/toolbox-go/toolbox"
)

// Aggregator mirrors the TypeScript helper by composing multiple middleware units
// into a single middleware.
func Aggregator[I any, O any](
	middlewares ...toolbox.LanguageModelMiddleware[I, O],
) toolbox.LanguageModelMiddleware[I, O] {
	return func(
		ctx context.Context,
		input toolbox.LanguageModelMiddlewareContext[I, O],
		next toolbox.LanguageModelMiddlewareNext[I, O],
	) (toolbox.LanguageModelCompletionContext[I, O], error) {
		chain := next
		for i := len(middlewares) - 1; i >= 0; i-- {
			mid := middlewares[i]
			curr := chain
			chain = func(
				ctx context.Context,
				inner toolbox.LanguageModelMiddlewareContext[I, O],
			) (toolbox.LanguageModelCompletionContext[I, O], error) {
				return mid(ctx, inner, curr)
			}
		}
		return chain(ctx, input)
	}
}
