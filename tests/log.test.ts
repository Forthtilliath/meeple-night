import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '../src/log.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('log', () => {
  it('writes one JSON line with the fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    log.info('Ready', { guilds: 2 });
    const entry = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(entry).toMatchObject({ level: 'info', msg: 'Ready', guilds: 2 });
    expect(typeof entry.time).toBe('string');
  });

  it('serializes errors to stderr', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = Object.assign(new Error('boom'), { code: 50013 });
    log.error('Failed', { error });
    const entry = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(entry.error).toMatchObject({ name: 'Error', message: 'boom', code: 50013 });
    expect(entry.error.stack).toContain('boom');
  });
});
