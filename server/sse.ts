import type { Response } from 'express';

export class SSEManager {
  private clients: Set<Response> = new Set();

  addClient(res: Response): void {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to call stream' })}\n\n`);

    this.clients.add(res);
    console.log(`[SSE] Client connected. Total: ${this.clients.size}`);

    // Remove client on disconnect
    res.on('close', () => {
      this.clients.delete(res);
      console.log(`[SSE] Client disconnected. Total: ${this.clients.size}`);
    });
  }

  broadcast(event: string, data: any): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
