import { CommandHandle, Sandbox as Container } from "e2b"

// Terminal class to manage a pseudo-terminal (PTY) in a sandbox environment
export class Terminal {
  private pty: CommandHandle | undefined // Holds the PTY process handle
  private container: Container // Reference to the "container," which is an E2B sandbox

  // Constructor initializes the Terminal with a container
  constructor(container: Container) {
    this.container = container
  }

  // Initialize the terminal with specified rows, columns, and data handler
  async init({
    rows = 20,
    cols = 80,
    onData,
  }: {
    rows?: number
    cols?: number
    onData: (responseData: string) => void
  }): Promise<void> {
    // Create a new PTY process
    this.pty = await this.container.pty.create({
      rows,
      cols,
      timeoutMs: 0,
      onData: (data: Uint8Array) => {
        onData(new TextDecoder().decode(data)) // Convert received data to string and pass to handler
      },
    })
  }

  // Send data to the terminal
  async sendData(data: string) {
    if (this.pty) {
      await this.container.pty.sendInput(
        this.pty.pid,
        new TextEncoder().encode(data)
      )
    } else {
      console.log("Cannot send data because pty is not initialized.")
    }
  }

  // Resize the terminal
  async resize(size: { cols: number; rows: number }): Promise<void> {
    if (this.pty) {
      await this.container.pty.resize(this.pty.pid, size)
    } else {
      console.log("Cannot resize terminal because pty is not initialized.")
    }
  }

  // Close the terminal, killing the PTY process and stopping the input stream
  async close(): Promise<void> {
    if (this.pty) {
      await this.pty.kill()
    } else {
      console.log("Cannot kill pty because it is not initialized.")
    }
  }
}

// Usage example:
// const terminal = new Terminal(sandbox);
// await terminal.init();
// terminal.sendData('ls -la');
// await terminal.resize({ cols: 100, rows: 30 });
// await terminal.close();
