import { describe, expect, it } from 'vitest';
import { DownloadError, downloadAttachment } from '../../src/bot/download.js';

const URL_OK = 'https://cdn.discordapp.com/attachments/1/2/collection.json';

/** A fetch stub that streams the body in small chunks without any Content-Length. */
function stub(body: string, status = 200): typeof fetch {
  return async () => {
    const bytes = new TextEncoder().encode(body);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 4) controller.enqueue(bytes.slice(i, i + 4));
        controller.close();
      },
    });
    return new Response(stream, { status });
  };
}

async function reason(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error instanceof DownloadError ? error.reason : 'other';
  }
}

describe('downloadAttachment', () => {
  it('returns the text of a Discord attachment', async () => {
    const text = await downloadAttachment(URL_OK, { maxBytes: 100, fetch: stub('[{"a":1}]') });
    expect(text).toBe('[{"a":1}]');
  });

  it('refuses other hosts, error statuses and oversized bodies', async () => {
    const fetchImpl = stub('[]');
    expect(
      await reason(
        downloadAttachment('https://evil.test/x.json', { maxBytes: 10, fetch: fetchImpl }),
      ),
    ).toBe('host');
    expect(await reason(downloadAttachment(URL_OK, { maxBytes: 10, fetch: stub('', 404) }))).toBe(
      'status',
    );
    expect(
      await reason(downloadAttachment(URL_OK, { maxBytes: 10, fetch: stub('x'.repeat(11)) })),
    ).toBe('size');
  });
});
