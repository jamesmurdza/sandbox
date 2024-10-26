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
    private ownerConnections: Record<string, Counter> = {}
    private sockets: Record<string, Set<Socket>> = {}

    ownerConnected(sandboxId: string) {
        this.ownerConnections[sandboxId] ??= new Counter()
        this.ownerConnections[sandboxId].increment()
    }

    ownerDisconnected(sandboxId: string) {
        this.ownerConnections[sandboxId]?.decrement()
    }

    ownerIsConnected(sandboxId: string): boolean {
        return this.ownerConnections[sandboxId]?.getValue() > 0
    }

    addConnectionForSandbox(socket: Socket, sandboxId: string) {
        this.sockets[sandboxId] ??= new Set()
        this.sockets[sandboxId].add(socket)
    }

    removeConnectionForSandbox(socket: Socket, sandboxId: string) {
        this.sockets[sandboxId]?.delete(socket)
    }

    connectionsForSandbox(sandboxId: string): Set<Socket> {
        return this.sockets[sandboxId] ?? new Set();
    }

}