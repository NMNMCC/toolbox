# toolbox-go

Go implementation of the composable middleware ideas used by `@nmnmcc/toolbox`.
The package keeps the same mental model—describe a function once and then call
it with predictable context—while embracing Go's generics and interfaces.

## Installation

```bash
go get github.com/nmnmcc/toolbox-go/toolbox
```

Optional helpers live in sibling packages:

- `github.com/nmnmcc/toolbox-go/toolbox/initializers`
- `github.com/nmnmcc/toolbox-go/toolbox/finalizers`
- `github.com/nmnmcc/toolbox-go/toolbox/middlewares`

## Describing regular functions

```go
package app

import (
	"context"
	"errors"

	"github.com/nmnmcc/toolbox-go/toolbox"
)

var addNumbers = toolbox.Describe(
	toolbox.Description[struct{ A, B int }, struct{ Sum int }]{
		Name:        "add_numbers",
		Description: "Add two integers and return their sum",
	},
	func(ctx context.Context, input struct{ A, B int }) (struct{ Sum int }, error) {
		if input.A < 0 || input.B < 0 {
			return struct{ Sum int }{}, errors.New("negative values are forbidden")
		}
		return struct{ Sum int }{Sum: input.A + input.B}, nil
	},
)
```

Metadata (name, description) stays attached to the returned `Described` value.

## Describing language-model powered functions

```go
package app

import (
	"context"
	"encoding/json"
	"time"

	"github.com/nmnmcc/toolbox-go/toolbox"
	"github.com/nmnmcc/toolbox-go/toolbox/finalizers"
	"github.com/nmnmcc/toolbox-go/toolbox/initializers"
	"github.com/nmnmcc/toolbox-go/toolbox/middlewares"
)

type echoClient struct{}

func (echoClient) Complete(ctx context.Context, req toolbox.CompletionRequest) (*toolbox.Completion, error) {
	payload, _ := json.Marshal(struct {
		Summary string `json:"summary"`
	}{Summary: req.Messages[len(req.Messages)-1].Content})

	return &toolbox.Completion{
		Choices: []toolbox.CompletionChoice{{
			Message: toolbox.Message{Role: "assistant", Content: string(payload)},
		}},
	}, nil
}

type summarizeInput struct {
	Text string `json:"text"`
}

type summarizeOutput struct {
	Summary string `json:"summary"`
}

var summarize = toolbox.DescribeLLM(
	toolbox.LanguageModelDescription[summarizeInput, summarizeOutput]{
		Description: toolbox.Description[summarizeInput, summarizeOutput]{
			Name:        "summarize",
			Description: "Summarize arbitrary text",
		},
		Model:  "gpt-4o",
		Client: echoClient{},
	},
	toolbox.LanguageModelImports[summarizeInput, summarizeOutput]{
		Initializer: initializers.Basic[summarizeInput, summarizeOutput](
			"You are a concise summarization assistant.",
		),
		Middlewares: []toolbox.LanguageModelMiddleware[summarizeInput, summarizeOutput]{
			middlewares.Logging[summarizeInput, summarizeOutput](nil),
			middlewares.Retry[summarizeInput, summarizeOutput](3, 250*time.Millisecond, nil),
		},
		Finalizer: finalizers.JSON[summarizeInput, summarizeOutput](),
	},
)
```

Callers now receive strong types while middlewares remain composable and
testable.

## Implementing a client

The only required integration point is the `LanguageModelClient` interface:

```go
type LanguageModelClient interface {
	Complete(ctx context.Context, req CompletionRequest) (*Completion, error)
}
```

Wrap any provider SDK (OpenAI, Anthropic, local models, etc.) by translating the
request and returning a `Completion` object. The `Raw` field lets you stash the
original provider response for debugging.

## Included helpers

- `initializers.Basic` – build the canonical system/user prompt
- `finalizers.JSON` – decode structured JSON responses
- `middlewares.Logging` – execution logging
- `middlewares.Retry` – exponential backoff retries
- `middlewares.Timeout` – per-call deadline enforcement
- `middlewares.Aggregator` – compose middleware bundles

These match the concepts from the TypeScript library so existing flows translate
directly into Go projects.
