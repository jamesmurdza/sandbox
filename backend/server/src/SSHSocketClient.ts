import { Client } from "ssh2"

// Interface defining the configuration for SSH connection
export interface SSHConfig {
  host: string
  port?: number
  username: string
  privateKey: Buffer
}

// Class to handle SSH connections and communicate with a Unix socket
export class SSHSocketClient {
  private conn: Client
  private config: SSHConfig
  private socketPath: string
  private isConnected: boolean = false

  // Constructor initializes the SSH client and sets up configuration
  constructor(config: SSHConfig, socketPath: string) {
    this.conn = new Client()
    this.config = { ...config, port: 22 } // Default port to 22 if not provided
    this.socketPath = socketPath

    this.setupTerminationHandlers()
  }

  // Set up handlers for graceful termination
  private setupTerminationHandlers() {
    process.on("SIGINT", this.closeConnection.bind(this))
    process.on("SIGTERM", this.closeConnection.bind(this))
  }

  // Method to close the SSH connection
  private closeConnection() {
    console.log("Closing SSH connection...")
    this.conn.end()
    this.isConnected = false
    process.exit(0)
  }

  // Method to establish the SSH connection
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn
        .on("ready", () => {
          console.log("SSH connection established")
          this.isConnected = true
          resolve()
        })
        .on("error", (err) => {
          console.error("SSH connection error:", err)
          this.isConnected = false
          reject(err)
        })
        .on("close", () => {
          console.log("SSH connection closed")
          this.isConnected = false
        })
        .connect(this.config)
    })
  }

  // Method to send data through the SSH connection to the Unix socket
  sendData(data: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error("SSH connection is not established"))
        return
      }

      // Use netcat to send data to the Unix socket
      this.conn.exec(
        `echo "${data}" | nc -U ${this.socketPath}`,
        (err, stream) => {
          if (err) {
            reject(err)
            return
          }

          stream
            .on("close", (code: number, signal: string) => {
              reject(
                new Error(
                  `Stream closed with code ${code} and signal ${signal}`
                )
              )
            })
            .on("data", (data: Buffer) => {
              resolve(data.toString())
            })
            .stderr.on("data", (data: Buffer) => {
              reject(new Error(data.toString()))
            })
        }
      )
    })
  }
}
