package toolbox

import (
	"encoding/json"
	"fmt"
)

// InputSchema defines how to parse and validate input.
type InputSchema[Input any] interface {
	Parse(any) (Input, error)
}

// OutputSchema defines how to parse and validate output.
type OutputSchema[Output any] interface {
	Parse(json.RawMessage) (Output, error)
}

// JSONSchema uses JSON encoding/decoding for schema validation.
type JSONSchema[T any] struct{}

// ParseInput parses input using JSON encoding/decoding.
func (JSONSchema[T]) ParseInput(v any) (T, error) {
	var result T
	
	// If v is already of type T, return it
	if t, ok := v.(T); ok {
		return t, nil
	}
	
	// Otherwise, marshal and unmarshal through JSON
	data, err := json.Marshal(v)
	if err != nil {
		return result, fmt.Errorf("failed to marshal input: %w", err)
	}
	
	if err := json.Unmarshal(data, &result); err != nil {
		return result, fmt.Errorf("failed to unmarshal input: %w", err)
	}
	
	return result, nil
}

// ParseOutput parses output using JSON encoding/decoding.
func (JSONSchema[T]) ParseOutput(data json.RawMessage) (T, error) {
	var result T
	if err := json.Unmarshal(data, &result); err != nil {
		return result, fmt.Errorf("failed to unmarshal output: %w", err)
	}
	return result, nil
}

// JSONInputSchema wraps JSONSchema to implement InputSchema.
type JSONInputSchema[T any] struct {
	JSONSchema[T]
}

// Parse implements InputSchema.
func (s JSONInputSchema[T]) Parse(v any) (T, error) {
	return s.ParseInput(v)
}

// JSONOutputSchema wraps JSONSchema to implement OutputSchema.
type JSONOutputSchema[T any] struct {
	JSONSchema[T]
}

// Parse implements OutputSchema.
func (s JSONOutputSchema[T]) Parse(data json.RawMessage) (T, error) {
	return s.ParseOutput(data)
}

// NewJSONSchema creates both input and output schemas for a type.
func NewJSONSchema[T any]() (InputSchema[T], OutputSchema[T]) {
	return JSONInputSchema[T]{}, JSONOutputSchema[T]{}
}
