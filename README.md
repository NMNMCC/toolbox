<p align="center">
  <h1 align="center">@nmnmcc/toolbox</h1>
</p>

<p align="center">
  Composable middleware for structured LLM calls with TypeScript
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nmnmcc/toolbox">
    <img src="https://img.shields.io/npm/v/@nmnmcc/toolbox.svg" alt="npm version" height="20">
  </a>
  <a href="https://www.npmjs.com/package/@nmnmcc/toolbox">
    <img src="https://img.shields.io/npm/dm/@nmnmcc/toolbox.svg" alt="npm downloads" height="20">
  </a>
</p>

# Introduction

`@nmnmcc/toolbox` is a TypeScript library for building structured, type-safe LLM
applications with composable middleware. It provides a functional approach to
defining language model interactions with strong type inference, schema
validation via Zod, and a middleware pattern inspired by web frameworks.

The library allows you to:

- **Define functions with LLM implementations** using Zod schemas for
  input/output validation
- **Compose middleware** to add capabilities like caching, retries, logging,
  memory, and ReAct-style tool calling
- **Build complex workflows** by orchestrating multiple LLM calls with full type
  safety
- **Reuse patterns** across different LLM-powered features in your application

**Key Features:**

- 🎯 **Type-safe** - Full TypeScript support with automatic type inference
- 🔗 **Composable** - Middleware-based architecture for building complex
  behaviors
- 📝 **Schema-driven** - Uses Zod for runtime validation and structured outputs
- 🔄 **ReAct support** - Built-in support for tool-calling and agentic workflows
- 🧩 **Extensible** - Easy to create custom middlewares and initializers
- 🪶 **Lightweight** - Minimal dependencies (OpenAI SDK, Zod, robot3)

# Table of Contents

- [Installation](#installation)
- [TypeScript Compatibility](#typescript-compatibility)
- [Getting Started](#getting-started)
- [Core Concepts](#core-concepts)
    - [The `describe` Function](#the-describe-function)
    - [Middleware Architecture](#middleware-architecture)
    - [Initializers and Finalizers](#initializers-and-finalizers)
- [API Reference](#api-reference)
    - [Core API](#core-api)
    - [Initializers](#initializers)
    - [Middlewares](#middlewares)
    - [Finalizers](#finalizers)
- [Examples](#examples)
- [License](#license)

# Installation

To install the stable version:

```bash
npm install @nmnmcc/toolbox zod openai
```

The library has peer dependencies on `zod` (^4) and `openai` (^6).

# TypeScript Compatibility

This library requires TypeScript 5.0+ with `strict` mode enabled. The library
leverages advanced TypeScript features for type inference and type safety.

**Supported versions:**

| Package version | TypeScript | Node.js |
| --------------- | ---------- | ------- |
| 0.4.x+          | 5.0+       | 18+     |

# Getting Started

Here's a simple example to get you started:

```typescript
import {z} from "zod"
import {describe} from "@nmnmcc/toolbox"
import {initializer} from "@nmnmcc/toolbox/initializers/initializer"
import {finalizer} from "@nmnmcc/toolbox/finalizers/finalizer"
import {retry} from "@nmnmcc/toolbox/middlewares/retry"
import {logging} from "@nmnmcc/toolbox/middlewares/logging"

// Define a simple summarization function
const summarize = describe(
	{
		name: "summarize",
		description: "Summarize the provided text",
		input: z.object({text: z.string().describe("Text to summarize")}),
		output: z.object({summary: z.string().describe("A concise summary")}),
		model: "gpt-4o",
	},
	[
		initializer(
			"You are a helpful assistant that summarizes text concisely.",
		),
		logging(),
		retry(2),
		finalizer(),
	],
)

// Use it like a regular async function
const result = await summarize({text: "Long article text goes here..."})

console.log(result.summary)
```

# Core Concepts

## The `describe` Function

The `describe` function is the core of the library. It has two forms:

### 1. Describing Regular Functions

Wrap any function with metadata:

```typescript
const add_numbers = describe(
	{
		name: "add_numbers",
		description: "Add two numbers together",
		input: z.object({
			a: z.number().describe("First addend"),
			b: z.number().describe("Second addend"),
		}),
		output: z.object({sum: z.number().describe("Sum of both numbers")}),
	},
	async ({a, b}) => {
		return {sum: a + b}
	},
)
```

### 2. Describing LLM-Powered Functions

Create functions backed by language models with middleware:

```typescript
const chat = describe(
	{
		name: "chat",
		description: "Have a conversation with an AI assistant",
		input: z.object({message: z.string()}),
		output: z.object({reply: z.string()}),
		model: "gpt-4o",
		// Any OpenAI chat completion parameters are supported
		temperature: 0.7,
		max_tokens: 1000,
	},
	[
		initializer("You are a helpful AI assistant."),
		// ... middlewares
		finalizer(),
	],
)
```

## Middleware Architecture

Middlewares follow a composable pattern similar to Express.js or Koa. Each
middleware can:

- Modify the context before the LLM call
- Intercept and transform the response
- Add side effects like logging or caching
- Short-circuit the chain (e.g., cache hit)

Middlewares are executed in order from top to bottom:

```typescript
;[
	initializer("system prompt"),
	memory({store}), // Loads conversation history
	cache({store}), // Checks cache before calling LLM
	logging(), // Logs request/response
	retry(3), // Retries on failure
	timeout(30000), // Adds timeout
	finalizer(), // Parses final output
]
```

The middleware chain pattern ensures:

- **Composability** - Mix and match middlewares as needed
- **Reusability** - Create middlewares once, use everywhere
- **Testability** - Test each middleware in isolation
- **Extensibility** - Easy to add custom behavior

## Initializers and Finalizers

**Initializers** convert input context into the initial message array:

```typescript
initializer("You are a helpful assistant")
// Creates: [
//   { role: "system", content: "You are a helpful assistant" },
//   { role: "user", content: "# function_name\n\nDescription\n\n{\"input\":\"data\"}" }
// ]
```

**Finalizers** extract the output from the LLM completion:

```typescript
finalizer() // Parses JSON response
finalizer(JSON.parse) // Custom parser
```

# API Reference

## Core API

### `describe`

Creates a described function - either a regular function with metadata or an
LLM-powered function with middleware.

**Type Signatures:**

```typescript
// For regular functions
function describe<Input, Output>(
	description: Description<Input, Output>,
	implementation: (input: z.input<Input>) => Promise<z.output<Output>>,
): Described<Input, Output>

// For LLM-powered functions
function describe<Input, Output>(
	description: LanguageModelDescription<Input, Output>,
	imports: LanguageModelImports<Input, Output>,
): Described<Input, Output>
```

**Description Object:**

```typescript
type Description<Input, Output> = {
	name: string // Function name
	description: string // What the function does
	input: Input // Zod schema for input
	output: Output // Zod schema for output
}

type LanguageModelDescription<Input, Output> = Description<Input, Output> & {
	model: string // OpenAI model name
	temperature?: number
	max_tokens?: number
	// ... any OpenAI ChatCompletionCreateParams
	client?: OpenAI // Optional custom OpenAI client
}
```

## Initializers

### `initializer`

Creates the initial message array with system prompt and user input.

**Import:**

```typescript
import {initializer} from "@nmnmcc/toolbox/initializers/initializer"
```

**Usage:**

```typescript
initializer("You are a helpful assistant that answers questions concisely.")
```

**Behavior:**

- Sets up system message with the provided prompt
- Formats user input as a structured message with function name, description,
  and JSON input
- Automatically configures `response_format` for structured output when output
  is a Zod object

## Middlewares

### `cache`

Caches LLM responses to avoid redundant API calls for identical inputs.

**Import:**

```typescript
import {cache} from "@nmnmcc/toolbox/middlewares/cache"
```

**Usage:**

```typescript
const store = {
	get: async (key: string) => cache_map.get(key),
	set: async (key: string, value: any) => cache_map.set(key, value),
}

cache({store})
cache({store, key: ctx => `${ctx.description.name}:${ctx.input.id}`})
```

**Options:**

- `store`: Object with `get(key)` and `set(key, value)` methods
- `key`: Optional function to generate cache key (defaults to function name +
  stringified input)

### `memory`

Maintains conversation history across multiple calls for stateful interactions.

**Import:**

```typescript
import {memory} from "@nmnmcc/toolbox/middlewares/memory"
```

**Usage:**

```typescript
const store = {
	get: async (key: string) => history_map.get(key),
	set: async (key: string, messages: any[]) => history_map.set(key, messages),
}

memory({store})
memory({store, key: ctx => ctx.input.session_id, max_messages: 50})
```

**Options:**

- `store`: Object with `get(key)` and `set(key, messages)` methods
- `key`: Optional function to generate memory key (defaults to function name)
- `max_messages`: Optional limit on conversation history length

**Example:**

```typescript
const chat = describe(
	{
		name: "chat",
		description: "Chat with memory",
		input: z.object({session_id: z.string(), message: z.string()}),
		output: z.object({reply: z.string()}),
		model: "gpt-4o",
	},
	[
		initializer("You are a helpful assistant."),
		memory({store, key: ctx => ctx.input.session_id}),
		finalizer(),
	],
)

// Each call with same session_id maintains history
await chat({session_id: "user-123", message: "My name is Alice"})
await chat({session_id: "user-123", message: "What's my name?"})
// Response: "Your name is Alice"
```

### `retry`

Retries failed LLM calls with exponential backoff.

**Import:**

```typescript
import {retry} from "@nmnmcc/toolbox/middlewares/retry"
```

**Usage:**

```typescript
retry(3) // Retry up to 3 times on failure
```

**Behavior:**

- Catches errors from downstream middleware
- Retries the operation up to N times
- Throws the last error if all retries fail

### `logging`

Logs execution time and token usage for monitoring.

**Import:**

```typescript
import {logging} from "@nmnmcc/toolbox/middlewares/logging"
```

**Usage:**

```typescript
logging() // Uses default console.log
logging({
	log: async ({context, result, elapsed_ms}) => {
		console.log(`${context.description.name} took ${elapsed_ms}ms`)
		console.log(`Tokens: ${result.completion.usage?.total_tokens}`)
	},
})
```

**Options:**

- `log`: Optional custom logging function that receives execution details

### `timeout`

Adds a timeout to LLM calls to prevent hanging.

**Import:**

```typescript
import {timeout} from "@nmnmcc/toolbox/middlewares/timeout"
```

**Usage:**

```typescript
timeout(30000) // 30 second timeout
```

**Behavior:**

- Wraps the downstream call with a timeout
- Throws `TimeoutError` if the call exceeds the specified duration

### `react`

Implements the ReAct (Reasoning and Acting) pattern for tool-calling and agentic
behavior.

**Import:**

```typescript
import {react} from "@nmnmcc/toolbox/middlewares/react"
```

**Usage:**

```typescript
// Define tools
const get_weather = describe(
	{
		name: "get_weather",
		description: "Get weather for a location",
		input: z.object({location: z.string()}),
		output: z.object({temperature: z.number(), condition: z.string()}),
	},
	async ({location}) => {
		// Implementation
		return {temperature: 72, condition: "sunny"}
	},
)

// Use in agent
const agent = describe(
	{
		name: "weather_agent",
		description: "Answer weather questions",
		input: z.object({query: z.string()}),
		output: z.object({answer: z.string()}),
		model: "gpt-4o",
	},
	[
		initializer(
			"You are a weather assistant. Use tools to answer questions.",
		),
		react({max_steps: 10, tools: [get_weather]}),
		finalizer(),
	],
)
```

**Options:**

- `max_steps`: Maximum number of reasoning/action iterations
- `tools`: Array of described functions that the LLM can call

**Behavior:**

- Automatically converts tools to OpenAI function definitions
- Executes tool calls and feeds results back to the LLM
- Continues until the LLM returns a final answer or max_steps is reached
- Throws `ReActMaxStepsReachedError` if the limit is exceeded

### `otel`

Adds OpenTelemetry tracing for observability.

**Import:**

```typescript
import {otel} from "@nmnmcc/toolbox/middlewares/otel"
```

**Usage:**

```typescript
import {trace} from "@opentelemetry/api"

const tracer = trace.getTracer("my-app")

otel({tracer})
otel({tracer, attributes: {service: "llm-service"}})
```

**Options:**

- `tracer`: OpenTelemetry tracer instance
- `attributes`: Optional additional span attributes

### `aggregator`

Composes multiple middlewares into a single middleware.

**Import:**

```typescript
import {aggregator} from "@nmnmcc/toolbox/middlewares/aggregator"
```

**Usage:**

```typescript
const standard_middlewares = aggregator(logging(), retry(3), timeout(30000))

const my_function = describe(
	{
		name: "my_function",
		description: "...",
		input: MyInput,
		output: MyOutput,
		model: "gpt-4o",
	},
	[initializer("..."), standard_middlewares, finalizer()],
)
```

**Behavior:**

- Chains multiple middlewares together
- Useful for creating reusable middleware bundles

## Finalizers

### `finalizer`

Extracts and parses the output from the LLM completion.

**Import:**

```typescript
import {finalizer} from "@nmnmcc/toolbox/finalizers/finalizer"
```

**Usage:**

```typescript
finalizer() // Uses JSON.parse by default
finalizer(JSON.parse) // Custom parser
finalizer(content => ({result: content})) // Transform the content
```

**Options:**

- `parse`: Optional custom parsing function (defaults to `JSON.parse`)

**Behavior:**

- Extracts `content` from the first message choice
- Parses it using the provided parser
- Throws `FinalizerContentNotFoundError` if content is missing

# Examples

## Basic Summarization with Caching

```typescript
import {z} from "zod"
import {describe} from "@nmnmcc/toolbox"
import {initializer} from "@nmnmcc/toolbox/initializers/initializer"
import {cache} from "@nmnmcc/toolbox/middlewares/cache"
import {retry} from "@nmnmcc/toolbox/middlewares/retry"
import {logging} from "@nmnmcc/toolbox/middlewares/logging"
import {finalizer} from "@nmnmcc/toolbox/finalizers/finalizer"

const cache_store = new Map()

const summarize = describe(
	{
		name: "summarize",
		description: "Summarize text with caching",
		input: z.object({text: z.string()}),
		output: z.object({summary: z.string()}),
		model: "gpt-4o",
	},
	[
		initializer("You are a summarization assistant."),
		cache({store: cache_store}),
		logging(),
		retry(2),
		finalizer(),
	],
)

const result = await summarize({text: "Long text..."})
console.log(result.summary)
```

## Stateful Chat with Memory

```typescript
import {z} from "zod"
import {describe} from "@nmnmcc/toolbox"
import {initializer} from "@nmnmcc/toolbox/initializers/initializer"
import {memory} from "@nmnmcc/toolbox/middlewares/memory"
import {finalizer} from "@nmnmcc/toolbox/finalizers/finalizer"

const memory_store = new Map()

const chat = describe(
	{
		name: "chat",
		description: "Chat with conversation memory",
		input: z.object({session_id: z.string(), message: z.string()}),
		output: z.object({reply: z.string()}),
		model: "gpt-4o",
	},
	[
		initializer("You are a helpful assistant."),
		memory({store: memory_store, key: ctx => ctx.input.session_id}),
		finalizer(),
	],
)

// Conversation maintains context per session
await chat({session_id: "user-1", message: "My name is Alice"})
const response = await chat({session_id: "user-1", message: "What's my name?"})
console.log(response.reply) // "Your name is Alice"
```

## ReAct Agent with Tool Calling

```typescript
import {z} from "zod"
import {describe} from "@nmnmcc/toolbox"
import {initializer} from "@nmnmcc/toolbox/initializers/initializer"
import {react} from "@nmnmcc/toolbox/middlewares/react"
import {finalizer} from "@nmnmcc/toolbox/finalizers/finalizer"

// Define tools
const search_database = describe(
	{
		name: "search_database",
		description: "Search the product database",
		input: z.object({query: z.string()}),
		output: z.object({results: z.array(z.string())}),
	},
	async ({query}) => {
		// Simulate database search
		return {results: ["Product A", "Product B"]}
	},
)

const calculate_price = describe(
	{
		name: "calculate_price",
		description: "Calculate total price with discount",
		input: z.object({base_price: z.number(), discount_percent: z.number()}),
		output: z.object({final_price: z.number()}),
	},
	async ({base_price, discount_percent}) => {
		return {final_price: base_price * (1 - discount_percent / 100)}
	},
)

// Create agent that can use tools
const shopping_agent = describe(
	{
		name: "shopping_agent",
		description:
			"Help users shop with product search and price calculation",
		input: z.object({request: z.string()}),
		output: z.object({response: z.string()}),
		model: "gpt-4o",
	},
	[
		initializer(
			"You are a shopping assistant. Use the available tools to help users find products and calculate prices.",
		),
		react({max_steps: 5, tools: [search_database, calculate_price]}),
		finalizer(),
	],
)

const result = await shopping_agent({
	request: "Find product A and calculate price with 20% discount on $100",
})
console.log(result.response)
```

## Complex Workflow: Travel Planner

```typescript
import {z} from "zod"
import {describe} from "@nmnmcc/toolbox"
import {initializer} from "@nmnmcc/toolbox/initializers/initializer"
import {react} from "@nmnmcc/toolbox/middlewares/react"
import {retry} from "@nmnmcc/toolbox/middlewares/retry"
import {logging} from "@nmnmcc/toolbox/middlewares/logging"
import {finalizer} from "@nmnmcc/toolbox/finalizers/finalizer"

// Define domain tools
const search_flights = describe(
	{
		name: "search_flights",
		description: "Search for flights",
		input: z.object({from: z.string(), to: z.string(), date: z.string()}),
		output: z.object({
			flights: z.array(
				z.object({
					departure: z.string(),
					arrival: z.string(),
					price: z.number(),
				}),
			),
		}),
	},
	async ({from, to, date}) => {
		// Implementation
		return {flights: [{departure: "08:00", arrival: "12:00", price: 350}]}
	},
)

const search_hotels = describe(
	{
		name: "search_hotels",
		description: "Search for hotels",
		input: z.object({
			city: z.string(),
			check_in: z.string(),
			check_out: z.string(),
		}),
		output: z.object({
			hotels: z.array(
				z.object({name: z.string(), price_per_night: z.number()}),
			),
		}),
	},
	async ({city}) => {
		// Implementation
		return {hotels: [{name: "Hotel A", price_per_night: 120}]}
	},
)

// Orchestrator that uses tools
const plan_trip = describe(
	{
		name: "plan_trip",
		description: "Plan a complete trip with flights and hotels",
		input: z.object({
			origin: z.string(),
			destination: z.string(),
			start_date: z.string(),
			end_date: z.string(),
			budget: z.number(),
		}),
		output: z.object({summary: z.string(), total_cost: z.number()}),
		model: "gpt-4o",
	},
	[
		initializer(
			"You are a travel planner. Use tools to find flights and hotels.",
		),
		react({max_steps: 8, tools: [search_flights, search_hotels]}),
		logging(),
		retry(2),
		finalizer(),
	],
)

const trip = await plan_trip({
	origin: "New York",
	destination: "Paris",
	start_date: "2025-06-01",
	end_date: "2025-06-07",
	budget: 3000,
})

console.log(trip.summary)
console.log(`Total cost: $${trip.total_cost}`)
```

## Custom Middleware

Create your own middleware for custom behavior:

```typescript
import type {
	LanguageModelMiddleware,
	LanguageModelMiddlewareContext,
	LanguageModelMiddlewareNext,
	LanguageModelCompletionContext,
} from "@nmnmcc/toolbox"

// Custom middleware that adds a prefix to all responses
const add_prefix = (prefix: string): LanguageModelMiddleware => {
	return async (context, next) => {
		const result = await next(context)

		// Modify the response
		if (result.completion.choices[0]?.message?.content) {
			result.completion.choices[0].message.content =
				prefix + result.completion.choices[0].message.content
		}

		return result
	}
}

// Use it in your function
const chat = describe(
	{
		name: "chat",
		description: "Chat with prefix",
		input: z.object({message: z.string()}),
		output: z.object({reply: z.string()}),
		model: "gpt-4o",
	},
	[initializer("You are helpful."), add_prefix("🤖 "), finalizer()],
)
```

# License

LGPL-2.1-or-later
