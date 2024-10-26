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
    ownerIsConnected(sandboxId: string): boolean {
        return this.ownerConnections[sandboxId]?.getValue() > 0
    }

    // Adds a connection for a sandbox
    addConnectionForSandbox(socket: Socket, sandboxId: string, isOwner: boolean) {
        this.sockets[sandboxId] ??= new Set()
        this.sockets[sandboxId].add(socket)

        // If the connection is for the owner, increments the owner connection counter
        if (isOwner) {
            this.ownerConnections[sandboxId] ??= new Counter()
            this.ownerConnections[sandboxId].increment()
        }
    }

    // Removes a connection for a sandbox
    removeConnectionForSandbox(socket: Socket, sandboxId: string, isOwner: boolean) {
        this.sockets[sandboxId]?.delete(socket)

        // If the connection being removed is for the owner, decrements the owner connection counter
        if (isOwner) {
            this.ownerConnections[sandboxId]?.decrement()
        }
    }

    // Returns the set of sockets connected to a given sandbox
    connectionsForSandbox(sandboxId: string): Set<Socket> {
        return this.sockets[sandboxId] ?? new Set();
    }

}