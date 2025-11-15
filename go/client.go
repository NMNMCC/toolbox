package toolbox

import (
	"os"

	"github.com/sashabaranov/go-openai"
)

// NewOpenAIClient creates a new OpenAI client from the OPENAI_API_KEY environment variable.
// Returns an error if the API key is not set.
func NewOpenAIClient() (*openai.Client, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, &ErrMissingAPIKey{}
	}
	return openai.NewClient(apiKey), nil
}

// ErrMissingAPIKey is returned when OPENAI_API_KEY is not set.
type ErrMissingAPIKey struct{}

func (e *ErrMissingAPIKey) Error() string {
	return "OPENAI_API_KEY environment variable is not set"
}
