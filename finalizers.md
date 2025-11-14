# Finalizers

Finalizers extract and parse the output from the LLM completion.

## `finalizer`

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

**Example:**

```typescript
import {z} from "zod"
import {describe} from "@nmnmcc/toolbox"
import {initializer} from "@nmnmcc/toolbox/initializers/initializer"
import {finalizer} from "@nmnmcc/toolbox/finalizers/finalizer"

const summarize = describe(
	{
		name: "summarize",
		description: "Summarize text",
		input: z.object({text: z.string()}),
		output: z.object({summary: z.string()}),
		model: "gpt-4o",
	},
	[
		initializer("You are a summarization assistant."),
		finalizer(), // Uses default JSON.parse
	],
)
```

**Type Signature:**

```typescript
type LanguageModelFinalizer<Input, Output> = (
	context: LanguageModelCompletionContext<Input, Output>,
) => Promise<LanguageModelOutputContext<Input, Output>>
```

## Creating Custom Finalizers

You can create custom finalizers to handle different response formats:

```typescript
import type {LanguageModelFinalizer} from "@nmnmcc/toolbox"

// Custom finalizer for plain text responses
const text_finalizer =
	<Input, Output>(): LanguageModelFinalizer<Input, Output> =>
	async ctx => {
		const content = ctx.completion.choices[0]?.message.content
		if (!content) {
			throw new Error("No content in response")
		}
		return {...ctx, output: {text: content}}
	}

// Custom finalizer with validation
const validated_finalizer =
	<Input, Output>(
		validate: (output: any) => boolean,
	): LanguageModelFinalizer<Input, Output> =>
	async ctx => {
		const content = ctx.completion.choices[0]?.message.content
		if (!content) {
			throw new Error("No content in response")
		}

		const output = JSON.parse(content)
		if (!validate(output)) {
			throw new Error("Output validation failed")
		}

		return {...ctx, output}
	}
```
