import { Socket } from "socket.io"

class Counter {
  private count: number = 0

  increment() {
    this.count++
  }

  decrement() {
    this.count = Math.max(0, this.count - 1)
  }

  getValue(): number {
    return this.count
  }
}

// Owner Connection Management
export class ConnectionManager {
  // Counts how many times the owner is connected to a sandbox
  private ownerConnections: Record<string, Counter> = {}
  // Stores all sockets connected to a given sandbox
  private sockets: Record<string, Set<Socket>> = {}

  // Checks if the owner of a sandbox is connected
  ownerIsConnected(projectId: string): boolean {
    return this.ownerConnections[projectId]?.getValue() > 0
  }

  // Adds a connection for a sandbox
  addConnectionForProject(socket: Socket, projectId: string, isOwner: boolean) {
    this.sockets[projectId] ??= new Set()
    this.sockets[projectId].add(socket)

    // If the connection is for the owner, increments the owner connection counter
    if (isOwner) {
      this.ownerConnections[projectId] ??= new Counter()
      this.ownerConnections[projectId].increment()
    }
  }

  // Removes a connection for a sandbox
  removeConnectionForProject(
    socket: Socket,
    projectId: string,
    isOwner: boolean
  ) {
    this.sockets[projectId]?.delete(socket)

    // If the connection being removed is for the owner, decrements the owner connection counter
    if (isOwner) {
      this.ownerConnections[projectId]?.decrement()
    }
  }

  // Returns the set of sockets connected to a given sandbox
  connectionsForProject(projectId: string): Set<Socket> {
    return this.sockets[projectId] ?? new Set()
  }
}
