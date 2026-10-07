import { createServer, type Server } from 'node:http';
import type { Client } from 'discord.js';
import { log } from './log.js';

/**
 * Tiny HTTP endpoint for the host's health checks: 200 while the gateway session is ready,
 * 503 otherwise. Nothing else is served.
 */
export function startHealthServer(client: Client, port: number): Server {
  const server = createServer((request, response) => {
    if (request.url !== '/health') {
      response.writeHead(404).end();
      return;
    }
    const ready = client.isReady();
    response.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' }).end(
      JSON.stringify({
        status: ready ? 'ok' : 'disconnected',
        ping: ready ? client.ws.ping : null,
        uptime: Math.round(process.uptime()),
      }),
    );
  });
  server.listen(port, () => log.info('Health endpoint listening', { port }));
  return server;
}

/**
 * discord.js reconnects by itself; if the session stays down anyway (stuck connection,
 * revoked token…), exit so the host restarts the process. Returns a stop function.
 */
export function startWatchdog(
  client: Pick<Client, 'isReady'>,
  maxDownMs = 5 * 60_000,
  exit: (code: number) => void = process.exit,
): () => void {
  let lastReady = Date.now();
  const timer = setInterval(() => {
    if (client.isReady()) {
      lastReady = Date.now();
      return;
    }
    if (Date.now() - lastReady > maxDownMs) {
      log.error('Gateway down for too long, exiting', { downMs: Date.now() - lastReady });
      exit(1);
    }
  }, 30_000);
  timer.unref();
  return () => clearInterval(timer);
}
