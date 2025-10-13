import {tool as t} from "./tool.ts"
import {z} from "zod"
import {assertEquals} from "@std/assert"

const tool = t(
	"Hello",
	"Say Hello!",
	z.object({name: z.string()}),
	z.object({message: z.string()}),
	({name}) => ({message: `Hello, ${name}!`}),
)

Deno.test("tool", () => {
	tool.function({name: "World"})

	assertEquals(tool.name, "Hello")
	assertEquals(tool.description, "Say Hello!")
	assertEquals(tool.function({name: "World"}), {message: "Hello, World!"})
})
