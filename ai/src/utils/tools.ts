import { z } from "zod"
import { AITool } from "../types"

interface SerperResponse {
  organic?: Array<{
    title: string
    link: string
    snippet: string
    date?: string
  }>
  searchInformation?: {
    totalResults: number
  }
}

export const webSearchTool: AITool = {
  description:
    "Search the web for current information using Google search results",
  parameters: z.object({
    query: z.string().describe("The search query to look up"),
    maxResults: z
      .number()
      .optional()
      .default(5)
      .describe("Maximum number of results to return"),
  }),
  execute: async ({ query, maxResults = 5 }) => {
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          num: maxResults,
        }),
      })

      const data = (await response.json()) as SerperResponse

      const results =
        data.organic?.slice(0, maxResults).map((result) => ({
          title: result.title,
          url: result.link,
          snippet: result.snippet,
          publishedDate: result.date,
        })) || []

      return {
        query,
        results,
        totalResults: data.searchInformation?.totalResults || 0,
        searchedAt: new Date().toISOString(),
      }
    } catch (error) {
      return {
        query,
        error: `Search failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        results: [],
        totalResults: 0,
        searchedAt: new Date().toISOString(),
      }
    }
  },
}

/**
 * Default tools collection
 */
export const defaultTools = {
  webSearch: webSearchTool,
}
