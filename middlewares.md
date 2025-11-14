# Middlewares

Middlewares provide composable behaviors for LLM calls. Each middleware can
modify the request, transform the response, or add side effects.

## Table of Contents

- [`cache`](#cache) - Cache LLM responses
- [`memory`](#memory) - Maintain conversation history
- [`retry`](#retry) - Retry failed calls
- [`logging`](#logging) - Log execution metrics
- [`timeout`](#timeout) - Add timeouts
- [`react`](#react) - ReAct pattern for tool calling
- [`otel`](#otel) - OpenTelemetry tracing
- [`aggregator`](#aggregator) - Compose multiple middlewares

## `cache`

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

## `memory`

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

await chat({session_id: "user-123", message: "My name is Alice"})
await chat({session_id: "user-123", message: "What's my name?"})
// Response: "Your name is Alice"
```

## `retry`

Retries failed LLM calls.

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

## `logging`

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

## `timeout`

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

## `react`

Implements the ReAct (Reasoning and Acting) pattern for tool-calling and agentic
behavior.

**Import:**

```typescript
import {react} from "@nmnmcc/toolbox/middlewares/react"
```

**Usage:**

```typescript
const get_weather = describe(
	{
		name: "get_weather",
		description: "Get weather for a location",
		input: z.object({location: z.string()}),
		output: z.object({temperature: z.number(), condition: z.string()}),
	},
	async ({location}) => {
		return {temperature: 72, condition: "sunny"}
	},
)

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

## `otel`

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

## `aggregator`

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
