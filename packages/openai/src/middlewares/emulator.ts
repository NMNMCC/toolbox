import type {IO} from "@pipechain/core"
import type {OpenAIIn, OpenAIOut} from "../../mod.ts"

// This middleware intercepts tool calls in the response and replaces them with mock results?
// Or does it provide mock tools to the input?
// If we want to emulate the *tool execution*, we should probably wrap the tools.
// But if we want to emulate the *LLM calling the tool* (i.e. force it to call a tool), that's different.
// "LLM tool emulator" likely means "Emulate the tool for the LLM".
// So we replace the real tools with mock tools.

export const toolEmulator =
	<NI extends Partial<OpenAIIn>, NO extends OpenAIOut>(
		mocks: Record<string, (args: any) => any>,
	) =>
	async (input: NI, next: IO<NI, NO>) => {
		// We don't change the input tools definition (so the LLM still sees them)
		// But we need to intercept the execution.
		// Since execution happens in the `react` middleware (or similar),
		// and `react` uses `input.tools` to execute.
		// We can wrap `input.tools` to use the mocks.

		if (input.tools) {
			input.tools = input.tools.map(tool => {
				if (tool.function.name in mocks) {
					return {
						...tool,
						execute: async (args: any) => {
							console.log(
								`Emulating tool ${tool.function.name} with args`,
								args,
							)
							return mocks[tool.function.name](args)
						},
					}
				}
				return tool
			})
		}
		return next(input)
	}
