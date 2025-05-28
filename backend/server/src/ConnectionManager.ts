import { Socket } from "socket.io"

// Owner Connection Management
export class ConnectionManager {
  // Stores all sockets connected to a given sandbox
  private sockets: Record<string, Set<Socket>> = {}

  // Adds a connection for a sandbox
  addConnectionForProject(socket: Socket, projectId: string) {
    this.sockets[projectId] ??= new Set()
    this.sockets[projectId].add(socket)
  }

  // Removes a connection for a sandbox
  removeConnectionForProject(socket: Socket, projectId: string) {
    this.sockets[projectId]?.delete(socket)
  }

  // Returns the set of sockets connected to a given sandbox
  connectionsForProject(projectId: string): Set<Socket> {
    return this.sockets[projectId] ?? new Set()
  }
}
