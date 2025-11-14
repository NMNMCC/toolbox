# Initializers

Initializers convert the input context into the initial message array that will
be sent to the language model.

## `initializer`

Creates the initial message array with a system prompt and formatted user input.

**Import:**

```typescript
import {initializer} from "@nmnmcc/toolbox/initializers/initializer"
```

**Usage:**

```typescript
initializer("You are a helpful assistant that answers questions concisely.")
```

**Behavior:**

- Sets up a system message with the provided prompt
- Formats user input as a structured message with function name, description,
  and JSON input
- Automatically configures `response_format` for structured output when the
  output schema is a Zod object

**Example:**

```typescript
import {z} from "zod"
import {describe} from "@nmnmcc/toolbox"
import {initializer} from "@nmnmcc/toolbox/initializers/initializer"
import {finalizer} from "@nmnmcc/toolbox/finalizers/finalizer"

const analyze = describe(
	{
		name: "analyze",
		description: "Analyze text sentiment",
		input: z.object({text: z.string()}),
		output: z.object({
			sentiment: z.enum(["positive", "negative", "neutral"]),
			confidence: z.number(),
		}),
		model: "gpt-4o",
	},
	[
		initializer(
			"You are a sentiment analysis assistant. Analyze the text and return the sentiment and confidence score.",
		),
		finalizer(),
	],
)
```

**Type Signature:**

```typescript
type LanguageModelInitializer<Input, Output> = (
	context: LanguageModelInputContext<Input, Output>,
) => Promise<LanguageModelMiddlewareContext<Input, Output>>
```

## Creating Custom Initializers

You can create custom initializers to modify how input is formatted:

```typescript
import type {LanguageModelInitializer} from "@nmnmcc/toolbox"
import {zodResponseFormat} from "openai/helpers/zod"
import {ZodObject} from "zod"

const custom_initializer =
	<Input, Output>(system: string): LanguageModelInitializer<Input, Output> =>
	async ctx => ({
		...ctx,
		description: {
			...ctx.description,
			response_format:
				ctx.description.output instanceof ZodObject
					? zodResponseFormat(
							ctx.description.output,
							ctx.description.name,
							{description: ctx.description.description},
						)
					: undefined,
		},
		messages: [
			{role: "system", content: system},
			{
				role: "user",
				content: `Task: ${ctx.description.name}\n\nInput: ${JSON.stringify(ctx.input)}`,
			},
		],
	})
```
