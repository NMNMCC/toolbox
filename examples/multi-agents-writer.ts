import {z} from "zod"

import {describe} from "../src/describe.ts"
import {initializer} from "../src/initializers/initializer.ts"
import {react} from "../src/middlewares/react.ts"
import {retry} from "../src/middlewares/retry.ts"
import {finalizer} from "../src/finalizers/finalizer.ts"

/**
 * Multi-agents example:
 *
 * - research_agent: gathers structured research about a topic
 * - writer_agent: writes a first draft for a specific audience
 * - editor_agent: edits and critiques the draft
 * - supervisor (multi_agent_writer): coordinates all agents via ReAct tools
 *
 * NOTE: This example requires OPENAI_API_KEY to be set in your environment.
 */

// 1) Shared domain types

const ResearchOutput = z.object({
	topic: z.string(),
	keyPoints: z.array(z.string()),
	outline: z.array(
		z.object({heading: z.string(), details: z.array(z.string())}),
	),
	sources: z.array(
		z.object({
			title: z.string(),
			url: z.string().optional(),
			note: z.string().optional(),
		}),
	),
})

const DraftOutput = z.object({
	topic: z.string(),
	audience: z.string(),
	outlineUsed: z.array(
		z.object({heading: z.string(), paragraph: z.string()}),
	),
	draft: z.string(),
})

const EditedOutput = z.object({
	finalDraft: z.string(),
	comments: z.array(
		z.object({
			type: z.enum(["style", "structure", "clarity", "accuracy", "tone"]),
			message: z.string(),
		}),
	),
	summaryChanges: z.string(),
})

// 2) Individual agents

const research_agent = describe(
	{
		name: "research_agent",
		description:
			"Research agent that expands a topic into key points, outline, and example sources.",
		input: z.object({
			topic: z.string().describe("Topic to research"),
			depth: z
				.enum(["brief", "normal", "deep"])
				.default("normal")
				.describe("Level of detail"),
		}),
		output: ResearchOutput,
		model: "gpt-4o",
	},
	[
		initializer(
			[
				"You are a research agent.",
				"Generate factual, concise key points and a logical outline.",
				"If the topic is ambiguous, pick a reasonable interpretation and note it.",
			].join("\n"),
		),
		finalizer(),
	],
)

const writer_agent = describe(
	{
		name: "writer_agent",
		description:
			"Writing agent that turns research into a readable article draft for a target audience.",
		input: z.object({
			topic: z.string(),
			audience: z
				.string()
				.describe("Target audience, e.g. 'beginner developers'"),
			tone: z
				.enum(["neutral", "friendly", "formal"])
				.default("friendly")
				.describe("Writing tone"),
			research: ResearchOutput,
		}),
		output: DraftOutput,
		model: "gpt-4o",
	},
	[
		initializer(
			[
				"You are a writing agent.",
				"Use the research outline and key points to write a coherent article.",
				"Adapt explanations and terminology to the specified audience.",
				"Do not invent completely new sections that contradict the outline.",
			].join("\n"),
		),
		finalizer(),
	],
)

const editor_agent = describe(
	{
		name: "editor_agent",
		description:
			"Editing agent that improves a draft and adds comments on potential issues.",
		input: z.object({
			topic: z.string(),
			audience: z.string(),
			draft: DraftOutput,
		}),
		output: EditedOutput,
		model: "gpt-4o",
	},
	[
		initializer(
			[
				"You are an editor and critic.",
				"Improve clarity, structure, and style while preserving core meaning.",
				"List important comments about issues, but keep the finalDraft already improved.",
			].join("\n"),
		),
		finalizer(),
	],
)

// 3) Supervisor agent orchestrating the others with ReAct

const MultiAgentWriterInput = z.object({
	topic: z.string(),
	audience: z.string().default("general readers"),
	tone: z.enum(["neutral", "friendly", "formal"]).default("friendly"),
	researchDepth: z.enum(["brief", "normal", "deep"]).default("normal"),
})

const MultiAgentWriterOutput = z.object({
	topic: z.string(),
	audience: z.string(),
	tone: z.string(),
	research: ResearchOutput,
	draft: DraftOutput,
	edited: EditedOutput,
	supervisorSummary: z.string(),
})

const multi_agent_writer = describe(
	{
		name: "multi_agent_writer",
		description:
			"Supervisor agent that coordinates research, writing, and editing agents to produce a final article.",
		input: MultiAgentWriterInput,
		output: MultiAgentWriterOutput,
		model: "gpt-4o",
	},
	[
		initializer(
			[
				"You are the supervising editor coordinating three tools:",
				"- research_agent: expand the topic into structured research.",
				"- writer_agent: turn research into a draft for the audience.",
				"- editor_agent: improve the draft and add comments.",
				"",
				"Use the tools in a logical order, possibly calling some more than once.",
				"At the end, return a JSON object matching the output schema exactly.",
			].join("\n"),
		),
		react({
			max_steps: 10,
			tools: [research_agent, writer_agent, editor_agent],
		}),
		retry(2),
		finalizer(),
	],
)

async function main() {
	const result = await multi_agent_writer({
		topic: "Building robust tool-calling workflows with TypeScript",
		audience: "experienced TypeScript backend developers",
		tone: "friendly",
		researchDepth: "normal",
	})

	console.dir(result, {depth: null})
}

void main()
