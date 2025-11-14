import {z} from "zod"

import {describe} from "../src/describe.ts"
import {initializer} from "../src/initializers/initializer.ts"
import {react} from "../src/middlewares/react.ts"
import {retry} from "../src/middlewares/retry.ts"
import {finalizer} from "../src/finalizers/finalizer.ts"

const get_weather = describe(
	{
		name: "getWeather",
		description: "Get current weather information for a specific location",
		input: z.object({
			location: z.string().describe("City name or location"),
			units: z
				.enum(["celsius", "fahrenheit"])
				.optional()
				.default("celsius"),
		}),
		output: z.object({
			location: z.string(),
			temperature: z.number(),
			condition: z.string(),
			humidity: z.number(),
			windSpeed: z.number(),
			units: z.enum(["celsius", "fahrenheit"]),
		}),
	},
	async ({location, units = "celsius"}) => {
		const weather_data = {
			beijing: {
				temperature: units === "celsius" ? 22 : 72,
				condition: "Partly cloudy",
				humidity: 65,
				windSpeed: 15,
			},
			shanghai: {
				temperature: units === "celsius" ? 25 : 77,
				condition: "Sunny",
				humidity: 70,
				windSpeed: 12,
			},
			newyork: {
				temperature: units === "celsius" ? 18 : 64,
				condition: "Cloudy",
				humidity: 55,
				windSpeed: 20,
			},
			london: {
				temperature: units === "celsius" ? 15 : 59,
				condition: "Rainy",
				humidity: 80,
				windSpeed: 18,
			},
		} as const

		const normalized = location.toLowerCase().replace(/\s+/g, "")
		const data =
			weather_data[normalized as keyof typeof weather_data] ??
			weather_data.beijing

		return {
			location,
			temperature: data.temperature,
			condition: data.condition,
			humidity: data.humidity,
			windSpeed: data.windSpeed,
			units,
		}
	},
)

const weather_query = describe(
	{
		name: "weather_query",
		description:
			"Answer weather-related questions by querying weather information for locations",
		input: z.object({
			query: z.string().describe("Natural language weather query"),
		}),
		output: z.object({
			answer: z.string().describe("Answer to the weather query"),
			weatherData: z
				.object({
					location: z.string(),
					temperature: z.number(),
					condition: z.string(),
					humidity: z.number(),
					windSpeed: z.number(),
					units: z.enum(["celsius", "fahrenheit"]),
				})
				.optional(),
		}),
		model: "gpt-4o",
	},
	[
		initializer(
			"You are a helpful weather assistant. Use the getWeather tool to fetch weather information when needed, then provide a clear and friendly answer to the user's question.",
		),
		react({max_steps: 10, tools: [get_weather]}),
		retry(3),
		finalizer(),
	],
)

async function main() {
	const result = await weather_query({
		query: "What's the weather like in Beijing today in celsius?",
	})

	console.dir(result, {depth: null})
}

void main()
