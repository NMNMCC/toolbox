package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/nmnmcc/go-toolbox"
	"github.com/nmnmcc/go-toolbox/middlewares"
	openai "github.com/sashabaranov/go-openai"
)

type WeatherInput struct {
	Location string `json:"location"`
	Units    string `json:"units,omitempty"`
}

type WeatherOutput struct {
	Location    string  `json:"location"`
	Temperature float64 `json:"temperature"`
	Condition   string  `json:"condition"`
	Humidity    int     `json:"humidity"`
	WindSpeed   float64 `json:"wind_speed"`
	Units       string  `json:"units"`
}

type WeatherQueryInput struct {
	Query string `json:"query"`
}

type WeatherQueryOutput struct {
	Answer      string         `json:"answer"`
	WeatherData *WeatherOutput `json:"weather_data,omitempty"`
}

func main() {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		log.Fatal("OPENAI_API_KEY environment variable not set")
	}

	client := openai.NewClient(apiKey)

	// Create a tool for getting weather
	getWeather := toolbox.Describe[WeatherInput, WeatherOutput](
		toolbox.Description{
			Name:        "getWeather",
			Description: "Get current weather information for a specific location",
		},
		func(ctx context.Context, input WeatherInput) (WeatherOutput, error) {
			// Simulate weather data
			weatherData := map[string]WeatherOutput{
				"beijing": {
					Location:    "Beijing",
					Temperature: 22,
					Condition:   "Partly cloudy",
					Humidity:    65,
					WindSpeed:   15,
					Units:       "celsius",
				},
				"shanghai": {
					Location:    "Shanghai",
					Temperature: 25,
					Condition:   "Sunny",
					Humidity:    70,
					WindSpeed:   12,
					Units:       "celsius",
				},
				"newyork": {
					Location:    "New York",
					Temperature: 18,
					Condition:   "Cloudy",
					Humidity:    55,
					WindSpeed:   20,
					Units:       "celsius",
				},
			}

			normalized := strings.ToLower(strings.ReplaceAll(input.Location, " ", ""))
			data, exists := weatherData[normalized]
			if !exists {
				data = weatherData["beijing"] // Default
				data.Location = input.Location
			}

			return data, nil
		},
	)

	// Create a weather query agent that uses ReAct
	weatherAgent := toolbox.DescribeLLM[WeatherQueryInput, WeatherQueryOutput](
		toolbox.LLMDescription{
			Description: toolbox.Description{
				Name:        "weather_query",
				Description: "Answer weather-related questions by querying weather information",
			},
			Model:  "gpt-4o",
			Client: client,
		},
		toolbox.DefaultInitializer[WeatherQueryInput, WeatherQueryOutput](
			"You are a helpful weather assistant. Use the getWeather tool to fetch weather information when needed.",
		),
		toolbox.DefaultFinalizer[WeatherQueryInput, WeatherQueryOutput](),
		middlewares.React[WeatherQueryInput, WeatherQueryOutput](middlewares.ReActOptions{
			MaxSteps: 10,
			Tools: []toolbox.Describable[any, any]{
				getWeather.(toolbox.Describable[any, any]),
			},
		}),
		middlewares.Retry[WeatherQueryInput, WeatherQueryOutput](3),
		middlewares.Logging[WeatherQueryInput, WeatherQueryOutput](),
	)

	// Use the agent
	ctx := context.Background()
	result, err := weatherAgent.Call(ctx, WeatherQueryInput{
		Query: "What's the weather like in Beijing?",
	})

	if err != nil {
		log.Fatalf("Error: %v", err)
	}

	fmt.Printf("Answer: %s\n", result.Answer)
	if result.WeatherData != nil {
		fmt.Printf("Weather Data: %+v\n", result.WeatherData)
	}
}
