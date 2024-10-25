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
export class OwnerConnectionManager {
    private connections: Record<string, Counter> = {}

    ownerConnected(sandboxId: string) {
        this.connections[sandboxId] ??= new Counter()
        this.connections[sandboxId].increment()
    }

    ownerDisconnected(sandboxId: string) {
        this.connections[sandboxId]?.decrement()
    }

    ownerIsConnected(sandboxId: string): boolean {
        return this.connections[sandboxId]?.getValue() > 0
    }
}