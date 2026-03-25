export interface QueueEntry {
  socketId: string;
  guestId: string;
  userId?: string;
  displayName: string;
  joinedAt: number;
}

export class QueueManager {
  // variantId → ordered list of waiting players
  private queues = new Map<string, QueueEntry[]>();
  private ratedQueues = new Map<string, QueueEntry[]>();

  join(variantId: string, entry: QueueEntry): void {
    if (!this.queues.has(variantId)) this.queues.set(variantId, []);
    const queue = this.queues.get(variantId)!;

    // Prevent duplicate queuing (same guestId)
    if (queue.some(e => e.guestId === entry.guestId)) return;

    queue.push(entry);
  }

  leave(socketId: string): void {
    for (const [, queue] of this.queues) {
      const idx = queue.findIndex(e => e.socketId === socketId);
      if (idx !== -1) queue.splice(idx, 1);
    }
    for (const [, queue] of this.ratedQueues) {
      const idx = queue.findIndex(e => e.socketId === socketId);
      if (idx !== -1) queue.splice(idx, 1);
    }
  }

  // Try to pair two players for a variant.
  // Returns the pair if found, null otherwise.
  tryMatch(variantId: string): [QueueEntry, QueueEntry] | null {
    const queue = this.queues.get(variantId);
    if (!queue || queue.length < 2) return null;
    const [p1, p2] = queue.splice(0, 2) as [QueueEntry, QueueEntry];
    return [p1, p2];
  }

  joinRated(variantId: string, entry: QueueEntry): void {
    if (!this.ratedQueues.has(variantId)) this.ratedQueues.set(variantId, []);
    const queue = this.ratedQueues.get(variantId)!;
    if (queue.some(e => e.guestId === entry.guestId)) return;
    queue.push(entry);
  }

  tryMatchRated(variantId: string): [QueueEntry, QueueEntry] | null {
    const queue = this.ratedQueues.get(variantId);
    if (!queue || queue.length < 2) return null;
    const [p1, p2] = queue.splice(0, 2) as [QueueEntry, QueueEntry];
    return [p1, p2];
  }

  // Find which queue a socket is in (for cleanup on disconnect)
  findSocket(socketId: string): string | null {
    for (const [variantId, queue] of this.queues) {
      if (queue.some(e => e.socketId === socketId)) return variantId;
    }
    for (const [variantId, queue] of this.ratedQueues) {
      if (queue.some(e => e.socketId === socketId)) return variantId;
    }
    return null;
  }

  getPosition(socketId: string): number {
    for (const [, queue] of this.queues) {
      const idx = queue.findIndex(e => e.socketId === socketId);
      if (idx !== -1) return idx + 1;
    }
    for (const [, queue] of this.ratedQueues) {
      const idx = queue.findIndex(e => e.socketId === socketId);
      if (idx !== -1) return idx + 1;
    }
    return 0;
  }
}
