// AIWorker class for handling AI-related operations
export class AIWorker {
  private aiWorkerUrl: string
  private cfAiKey: string
  private databaseWorkerUrl: string
  private workersKey: string

  // Constructor to initialize AIWorker with necessary URLs and keys
  constructor(
    aiWorkerUrl: string,
    cfAiKey: string,
    databaseWorkerUrl: string,
    workersKey: string
  ) {
    this.aiWorkerUrl = aiWorkerUrl
    this.cfAiKey = cfAiKey
    this.databaseWorkerUrl = databaseWorkerUrl
    this.workersKey = workersKey
  }

  // Method to generate code based on user input
  async generateCode(
    userId: string,
    fileName: string,
    code: string,
    line: number,
    instructions: string
  ): Promise<{ response: string; success: boolean }> {
    try {
      const fetchPromise = fetch(
        `${process.env.DATABASE_WORKER_URL}/api/sandbox/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `${process.env.WORKERS_KEY}`,
          },
          body: JSON.stringify({
            userId: userId,
          }),
        }
      )

      // Generate code from cloudflare workers AI
      const generateCodePromise = fetch(
        `${process.env.AI_WORKER_URL}/api?fileName=${encodeURIComponent(
          fileName
        )}&code=${encodeURIComponent(code)}&line=${encodeURIComponent(
          line
        )}&instructions=${encodeURIComponent(instructions)}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `${process.env.CF_AI_KEY}`,
          },
        }
      )

      const [fetchResponse, generateCodeResponse] = await Promise.all([
        fetchPromise,
        generateCodePromise,
      ])

      if (!generateCodeResponse.ok) {
        throw new Error(`HTTP error! status: ${generateCodeResponse.status}`)
      }

      const reader = generateCodeResponse.body?.getReader()
      const decoder = new TextDecoder()
      let result = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          result += decoder.decode(value, { stream: true })
        }
      }

      // The result should now contain only the modified code
      return { response: result.trim(), success: true }
    } catch (e: any) {
      console.error("Error generating code:", e)
      return {
        response: "Error generating code. Please try again.",
        success: false,
      }
    }
  }
}
