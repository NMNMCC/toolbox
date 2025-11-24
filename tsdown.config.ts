import {defineConfig} from "tsdown"
import {dirname} from "node:path"
import {fileURLToPath} from "node:url"

export default defineConfig({
	name: "pipechain",
	cwd: dirname(fileURLToPath(import.meta.url)),
	workspace: {include: ["./packages/*"]},
	entry: "mod.ts",
	outDir: "dist",
	format: ["esm"],
	dts: true,
	clean: true,
	target: ["node22", "deno2"],
	tsconfig: "tsconfig.json",
	report: false,
	exports: {all: true},
})
