/** Attachments are always served by Discord's CDN: refuse anything else. */
const ALLOWED_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);

export class DownloadError extends Error {
  constructor(readonly reason: 'host' | 'status' | 'size') {
    super(`Download refused: ${reason}`);
  }
}

export interface DownloadOptions {
  maxBytes: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

/**
 * Downloads a Discord attachment as text, enforcing the size while reading: the declared
 * attachment size and Content-Length are hints, not guarantees.
 */
export async function downloadAttachment(
  url: string,
  { maxBytes, timeoutMs = 15_000, fetch: fetchImpl = fetch }: DownloadOptions,
): Promise<string> {
  if (!ALLOWED_HOSTS.has(new URL(url).hostname)) throw new DownloadError('host');
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new DownloadError('status');
  if (Number(response.headers.get('content-length') ?? 0) > maxBytes) {
    throw new DownloadError('size');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new DownloadError('size');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
