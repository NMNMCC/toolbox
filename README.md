# @nmnmcc/toolbox

Composable middleware for structured LLM calls with TypeScript

[![npm version](https://img.shields.io/npm/v/@nmnmcc/toolbox.svg)](https://www.npmjs.com/package/@nmnmcc/toolbox)
[![npm downloads](https://img.shields.io/npm/dm/@nmnmcc/toolbox.svg)](https://www.npmjs.com/package/@nmnmcc/toolbox)

## Introduction

`@nmnmcc/toolbox` is a TypeScript library for building structured, type-safe LLM applications with composable middleware. It provides a functional approach to defining language model interactions with strong type inference, schema validation via Zod, and a middleware pattern inspired by web frameworks.

**Key Features:**

- **Type-safe** - Full TypeScript support with automatic type inference
- **Composable** - Middleware-based architecture for building complex behaviors
- **Schema-driven** - Uses Zod for runtime validation and structured outputs
- **Extensible** - Easy to create custom middlewares and initializers

## Table of Contents

- [Installation](#installation)
- [TypeScript Compatibility](#typescript-compatibility)
- [The `describe` Function](#the-describe-function)
  - [Describing Regular Functions](#describing-regular-functions)
  - [Describing LLM-Powered Functions](#describing-llm-powered-functions)
- [Extending the Library](#extending-the-library)
  - [Creating Custom Middleware](#creating-custom-middleware)
  - [Middleware Interface](#middleware-interface)
  - [Custom Middleware Examples](#custom-middleware-examples)
- [Built-in Components](#built-in-components)
- [License](#license)

## Installation

```bash
npm install @nmnmcc/toolbox zod openai
```

The library has peer dependencies on `zod` (^4) and `openai` (^6).

## TypeScript Compatibility

This library requires TypeScript 5.0+ with `strict` mode enabled.

| Package version | TypeScript | Node.js |
| --------------- | ---------- | ------- |
| 0.4.x+          | 5.0+       | 18+     |

## The `describe` Function

The `describe` function is the core of the library. It has two forms:

### Describing Regular Functions

Wrap any function with metadata for use as tools in ReAct agents:

```typescript
import {z} from "zod"
import {describe} from "@nmnmcc/toolbox"

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

const result = await add_numbers({a: 1, b: 2})
console.log(result.sum) // 3
```

### Describing LLM-Powered Functions

Create functions backed by language models with a middleware chain:

```typescript
import {z} from "zod"
import {describe} from "@nmnmcc/toolbox"
import {initializer} from "@nmnmcc/toolbox/initializers/initializer"
import {finalizer} from "@nmnmcc/toolbox/finalizers/finalizer"
import {retry} from "@nmnmcc/toolbox/middlewares/retry"
import {logging} from "@nmnmcc/toolbox/middlewares/logging"

const summarize = describe(
	{
		name: "summarize",
		description: "Summarize the provided text",
		input: z.object({text: z.string().describe("Text to summarize")}),
		output: z.object({summary: z.string().describe("A concise summary")}),
		model: "gpt-4o",
		temperature: 0.7,
	},
	[
		initializer("You are a helpful assistant that summarizes text concisely."),
		logging(),
		retry(2),
		finalizer(),
	],
)

const result = await summarize({text: "Long article text goes here..."})
console.log(result.summary)
```

**Type Signature:**

```typescript
type Description<Input, Output> = {
	name: string
	description: string
	input: Input // Zod schema
	output: Output // Zod schema
}

type LanguageModelDescription<Input, Output> = Description<Input, Output> & {
	model: string // OpenAI model name
	temperature?: number
	max_tokens?: number
	// ... any OpenAI ChatCompletionCreateParams
	client?: OpenAI // Optional custom OpenAI client
}

// For regular functions
function describe<Input, Output>(
	description: Description<Input, Output>,
	implementation: (input: z.input<Input>) => Promise<z.output<Output>>,
): Described<Input, Output>

// For LLM-powered functions
function describe<Input, Output>(
	description: LanguageModelDescription<Input, Output>,
	imports: [initializer, ...middlewares, finalizer],
): Described<Input, Output>
```

## Extending the Library

The library is designed to be extended with custom middleware. This section explains how to create your own middleware to add custom behavior to your LLM calls.

### Creating Custom Middleware

Middleware in this library follows a pattern similar to Express.js or Koa. Each middleware is a function that receives a context and a `next` function, allowing you to:

- Inspect or modify the request context before calling the LLM
- Call `next(context)` to continue the chain
- Inspect or modify the completion result after the LLM call
- Short-circuit the chain by returning early (e.g., for caching)

### Middleware Interface

```typescript
import type {
	LanguageModelMiddleware,
	LanguageModelMiddlewareContext,
	LanguageModelMiddlewareNext,
	LanguageModelCompletionContext,
} from "@nmnmcc/toolbox"

type LanguageModelMiddleware<Input, Output> = (
	context: LanguageModelMiddlewareContext<Input, Output>,
	next: LanguageModelMiddlewareNext<Input, Output>,
) => Promise<LanguageModelCompletionContext<Input, Output>>
```

**Context Structure:**

```typescript
type LanguageModelMiddlewareContext<Input, Output> = {
	description: LanguageModelDescription<Input, Output>
	initializer: LanguageModelInitializer<Input, Output>
	middlewares: LanguageModelMiddleware<Input, Output>[]
	finalizer: LanguageModelFinalizer<Input, Output>
	usage: OpenAI.CompletionUsage
	input: z.output<Input>
	tools?: OpenAI.Chat.Completions.ChatCompletionFunctionTool[]
	messages: OpenAI.ChatCompletionMessageParam[]
}

type LanguageModelCompletionContext<Input, Output> =
	LanguageModelMiddlewareContext<Input, Output> & {
		completion: OpenAI.Chat.Completions.ChatCompletion
	}
```

### Custom Middleware Examples

#### Example 1: Simple Logging Middleware

```typescript
import type {LanguageModelMiddleware} from "@nmnmcc/toolbox"

const simple_logger = <Input, Output>(): LanguageModelMiddleware<
	Input,
	Output
> => {
	return async (context, next) => {
		console.log(`[${context.description.name}] Starting call`)
		const start = Date.now()

		const result = await next(context)

		const elapsed = Date.now() - start
		console.log(`[${context.description.name}] Completed in ${elapsed}ms`)

		return result
	}
}
```

#### Example 2: Response Transformation Middleware

```typescript
import type {LanguageModelMiddleware} from "@nmnmcc/toolbox"

const add_prefix = <Input, Output>(
	prefix: string,
): LanguageModelMiddleware<Input, Output> => {
	return async (context, next) => {
		const result = await next(context)

		// Modify the response content
		const message = result.completion.choices[0]?.message
		if (message?.content) {
			message.content = prefix + message.content
		}

		return result
	}
}
```

#### Example 3: Caching Middleware

```typescript
import type {LanguageModelMiddleware} from "@nmnmcc/toolbox"

const simple_cache = <Input, Output>(
	store: Map<string, any>,
): LanguageModelMiddleware<Input, Output> => {
	return async (context, next) => {
		const cache_key = `${context.description.name}:${JSON.stringify(context.input)}`

		// Check cache
		const cached = store.get(cache_key)
		if (cached) {
			console.log("Cache hit!")
			return cached
		}

		// Call LLM and cache result
		const result = await next(context)
		store.set(cache_key, result)

		return result
	}
}
```

#### Example 4: Error Handling Middleware

```typescript
import type {LanguageModelMiddleware} from "@nmnmcc/toolbox"

const error_handler = <Input, Output>(
	on_error: (error: Error) => void,
): LanguageModelMiddleware<Input, Output> => {
	return async (context, next) => {
		try {
			return await next(context)
		} catch (error) {
			on_error(error as Error)
			throw error
		}
	}
}
```

#### Example 5: Request Modification Middleware

```typescript
import type {LanguageModelMiddleware} from "@nmnmcc/toolbox"

const add_context = <Input, Output>(
	additional_context: string,
): LanguageModelMiddleware<Input, Output> => {
	return async (context, next) => {
		// Add additional context to messages
		const modified_context = {
			...context,
			messages: [
				...context.messages,
				{
					role: "system" as const,
					content: additional_context,
				},
			],
		}

		return await next(modified_context)
	}
}
```

#### Example 6: Composing Multiple Middlewares

```typescript
import type {LanguageModelMiddleware} from "@nmnmcc/toolbox"

const aggregator = <Input, Output>(
	...middlewares: LanguageModelMiddleware<Input, Output>[]
): LanguageModelMiddleware<Input, Output> => {
	return async (context, next) => {
		const chain = middlewares.reduceRight(
			(prev, curr) => ctx => curr(ctx, prev),
			next,
		)
		return chain(context)
	}
}

// Usage
const standard_middlewares = aggregator(logging(), retry(3), timeout(30000))
```

## Built-in Components

This library comes with several built-in components to help you get started quickly. For detailed documentation, see:

- **[Initializers](./initializers.md)** - Convert input into initial message arrays
  - `initializer` - Standard initializer with system prompt
- **[Middlewares](./middlewares.md)** - Composable middleware for common patterns
  - `cache` - Cache LLM responses
  - `memory` - Maintain conversation history
  - `retry` - Retry failed calls
  - `logging` - Log execution metrics
  - `timeout` - Add timeouts
  - `react` - ReAct pattern for tool calling
  - `otel` - OpenTelemetry tracing
  - `aggregator` - Compose multiple middlewares
- **[Finalizers](./finalizers.md)** - Extract output from completions
  - `finalizer` - Standard JSON parser

## License

LGPL-2.1-or-later
