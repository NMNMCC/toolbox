import type {IO} from "@pipechain/core"
import type {OpenAIIn, OpenAIOut} from "../../mod.ts"

// This middleware manages a TODO list.
// It injects the current TODO list into the system prompt.
// It also provides a tool to update the TODO list.

export type TodoItem = {
	id: string
	task: string
	status: "pending" | "completed"
}

export const todoList = <NI extends Partial<OpenAIIn>, NO extends OpenAIOut>(
	initialTodos: TodoItem[] = [],
) => {
	let todos = [...initialTodos]

	const tools = [
		{
			type: "function" as const,
			function: {
				name: "manage_todo",
				description: "Add, update, or delete todo items",
				parameters: {
					type: "object",
					properties: {
						action: {
							type: "string",
							enum: ["add", "complete", "delete"],
						},
						task: {type: "string"},
						id: {type: "string"},
					},
					required: ["action"],
				},
			},
			execute: async ({action, task, id}: any) => {
				if (action === "add") {
					const newId = Math.random().toString(36).substring(7)
					todos.push({id: newId, task, status: "pending"})
					return `Added task: ${task} (ID: ${newId})`
				} else if (action === "complete") {
					const todo = todos.find(t => t.id === id)
					if (todo) {
						todo.status = "completed"
						return `Completed task: ${todo.task}`
					}
					return "Task not found"
				} else if (action === "delete") {
					todos = todos.filter(t => t.id !== id)
					return "Deleted task"
				}
				return "Invalid action"
			},
		},
	]

	return async (input: NI, next: IO<NI, NO>) => {
		// Inject TODO list into system prompt
		const todoString = todos
			.map(
				t =>
					`- [${t.status === "completed" ? "x" : " "}] ${t.task} (ID: ${t.id})`,
			)
			.join("\n")

		const systemPrompt = `\nCurrent TODO List:\n${todoString}\nUse the 'manage_todo' tool to update this list.`

		input.messages = input.messages || []
		const systemMsg = input.messages.find(m => m.role === "system")
		if (systemMsg) {
			systemMsg.content += systemPrompt
		} else {
			input.messages.unshift({role: "system", content: systemPrompt})
		}

		// Add the tool
		input.tools = [...(input.tools || []), ...tools]

		return next(input)
	}
}
