import pino from "pino"
import pretty from "pino-pretty"

const stream = pretty({
	colorize: true,
})
export const logger = pino({
	level: Deno.env.get("LOG_LEVEL") ?? "info",
	name: "toolbox",
}, stream)
