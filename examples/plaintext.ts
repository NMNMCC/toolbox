import z from "zod"
import {describe} from "../src/describe.ts"
import {finalizer} from "../src/finalizers/finalizer.ts"
import {initializer} from "../src/initializers/initializer.ts"

const plaintext = describe(
	{
		name: "translator",
		description: "a simple translator",
		input: z.string().describe("raw text"),
		output: z.string().describe("english text"),
		model: "",
	},
	[initializer(), finalizer()],
)

plaintext("Hola")
