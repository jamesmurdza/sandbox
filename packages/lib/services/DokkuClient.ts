import { SSHConfig, SSHSocketClient } from "./SSHSocketClient"

// Interface for the response structure from Dokku commands
export interface DokkuResponse {
  ok: boolean
  output: string
}

// DokkuClient class extends SSHSocketClient to interact with Dokku via SSH
export class DokkuClient extends SSHSocketClient {
  constructor(config: SSHConfig) {
    // Initialize with Dokku daemon socket path
    super(config, "/var/run/dokku-daemon/dokku-daemon.sock")
  }

  // Send a command to Dokku and parse the response
  async sendCommand(command: string): Promise<DokkuResponse> {
    try {
      const response = await this.sendData(command)

      if (typeof response !== "string") {
        throw new Error("Received data is not a string")
      }

      // Parse the JSON response from Dokku
      return JSON.parse(response)
    } catch (error: any) {
      throw new Error(`Failed to send command: ${error.message}`)
    }
  }

  // List all deployed Dokku apps
  async listApps(): Promise<string[]> {
    const response = await this.sendCommand("--quiet apps:list")
    return response.output.split("\n")
  }

  // Get the creation timestamp of an app
  async getAppCreatedAt(appName: string): Promise<number> {
    const response = await this.sendCommand(
      `apps:report --app-created-at ${appName}`
    )
    const createdAt = parseInt(response.output.trim(), 10)

    if (isNaN(createdAt)) {
      throw new Error(
        `Failed to retrieve creation timestamp for app ${appName}`
      )
    }

    return createdAt
  }

  // Check if an app exists
  async appExists(appName: string): Promise<boolean> {
    const response = await this.sendCommand(`apps:exists ${appName}`)
    return response.output.includes("App") === false
  }
}

export { SSHConfig }
