import {z} from "zod"

import {describe} from "../src/describe.ts"
import {initializer} from "../src/initializers/initializer.ts"
import {react} from "../src/middlewares/react.ts"
import {retry} from "../src/middlewares/retry.ts"
import {finalizer} from "../src/finalizers/finalizer.ts"

/**
 * This example demonstrates a more complex workflow:
 *
 * - Several small tools (`search_flights`, `search_hotels`, `recommend_activities`)
 * - One orchestrator tool (`plan_trip`) that calls those tools via ReAct
 * - `initializer` that provides system prompt and input framing
 * - `retry` middleware that retries the LLM call on failure
 * - `finalizer` that parses the model output as JSON into the Zod schema
 *
 * NOTE: This example requires OPENAI_API_KEY to be set in your environment.
 */

// 1) Domain data types
const Flight = z.object({
	from: z.string(),
	to: z.string(),
	departure: z.string(),
	arrival: z.string(),
	airline: z.string(),
	price: z.number(),
})

const Hotel = z.object({
	name: z.string(),
	location: z.string(),
	pricePerNight: z.number(),
	rating: z.number().min(0).max(5),
})

const Activity = z.object({
	title: z.string(),
	description: z.string(),
	durationHours: z.number(),
	price: z.number(),
})

// 2) Low-level tools
const search_flights = describe(
	{
		name: "search_flights",
		description:
			"Search for example flights between two cities on a specific date.",
		input: z.object({
			from: z.string().describe("Departure city"),
			to: z.string().describe("Destination city"),
			date: z.string().describe("Departure date in YYYY-MM-DD format"),
		}),
		output: z.object({
			flights: z.array(Flight),
		}),
	},
	async ({from, to, date}) => {
		// In a real app this would call an external API.
		// Here we just simulate a couple of options.
		return {
			flights: [
				{
					from,
					to,
					departure: `${date}T08:00:00`,
					arrival: `${date}T12:00:00`,
					airline: "Example Air",
					price: 350,
				},
				{
					from,
					to,
					departure: `${date}T15:00:00`,
					arrival: `${date}T19:00:00`,
					airline: "Sample Airlines",
					price: 420,
				},
			],
		}
	},
)

const search_hotels = describe(
	{
		name: "search_hotels",
		description:
			"Search for example hotels in a city within a price range and date range.",
		input: z.object({
			city: z.string(),
			checkIn: z.string().describe("Check-in date in YYYY-MM-DD format"),
			checkOut: z.string().describe("Check-out date in YYYY-MM-DD format"),
			maxPricePerNight: z.number().describe("Maximum budget per night"),
		}),
		output: z.object({
			hotels: z.array(Hotel),
		}),
	},
	async ({city, maxPricePerNight}) => {
		const base: Omit<z.infer<typeof Hotel>, "pricePerNight"> = {
			name: "Central Example Hotel",
			location: city,
			rating: 4.3,
		}

		return {
			hotels: [
				{...base, pricePerNight: Math.min(maxPricePerNight, 120)},
				{...base, name: "Budget Stay", pricePerNight: 80},
				{...base, name: "Premium Suites", pricePerNight: 200},
			],
		}
	},
)

const recommend_activities = describe(
	{
		name: "recommend_activities",
		description:
			"Recommend example activities for a city given preferences and budget.",
		input: z.object({
			city: z.string(),
			interests: z.array(z.string()).describe("User interests"),
			maxBudget: z.number().describe("Approximate max budget for activities"),
		}),
		output: z.object({
			activities: z.array(Activity),
		}),
	},
	async ({city, interests, maxBudget}) => {
		const basePrice = Math.max(10, Math.min(maxBudget / 3, 60))

		const activities: z.infer<typeof Activity>[] = [
			{
				title: `Walking tour of ${city}`,
				description: `Guided walking tour exploring the main sights of ${city}.`,
				durationHours: 3,
				price: basePrice,
			},
			{
				title: `Local food tasting in ${city}`,
				description: `Sample popular local dishes and learn about the cuisine.`,
				durationHours: 2,
				price: basePrice + 15,
			},
		]

		if (interests.includes("museum")) {
			activities.push({
				title: `${city} museum pass`,
				description: `Access to several museums in ${city}.`,
				durationHours: 4,
				price: basePrice + 20,
			})
		}

		return {activities}
	},
)

// 3) High-level orchestrator using ReAct + retry + finalizer

const PlanTripInput = z.object({
	origin: z.string(),
	destination: z.string(),
	startDate: z.string().describe("Trip start date in YYYY-MM-DD format"),
	endDate: z.string().describe("Trip end date in YYYY-MM-DD format"),
	budget: z.number().describe("Total budget for the trip"),
	interests: z.array(z.string()).default([]),
})

const PlanTripOutput = z.object({
	summary: z.string().describe("High-level explanation of the plan"),
	selectedFlight: Flight.optional(),
	selectedHotel: Hotel.optional(),
	dayByDayPlan: z.array(
		z.object({
			day: z.number(),
			date: z.string(),
			activities: z.array(Activity),
		}),
	),
	notes: z.string().optional(),
})

const plan_trip = describe(
	{
		name: "plan_trip",
		description:
			"Plan a trip using tools to search flights, hotels and activities, then assemble a structured travel plan.",
		input: PlanTripInput,
		output: PlanTripOutput,
		model: "gpt-4o",
	},
	[
		initializer(
			[
				"You are a travel-planning assistant.",
				"Given the user's constraints, you should:",
				"1) Use the tools to search flights, hotels, and activities.",
				"2) Pick reasonable options that fit the budget and dates.",
				"3) Produce a structured JSON response that matches the output schema exactly.",
				"4) Keep explanations concise but clear.",
			].join("\n"),
		),
		react({
			max_steps: 8,
			tools: [search_flights, search_hotels, recommend_activities],
		}),
		retry(2),
		finalizer(),
	],
)

async function main() {
	const result = await plan_trip({
		origin: "Shanghai",
		destination: "Tokyo",
		startDate: "2025-04-01",
		endDate: "2025-04-05",
		budget: 3000,
		interests: ["food", "museum", "shopping"],
	})

	console.dir(result, {depth: null})
}

void main()


