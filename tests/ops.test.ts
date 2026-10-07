import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Client } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backupDatabase } from '../src/backup.js';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db/client.js';
import { startHealthServer, startWatchdog } from '../src/health.js';
import { dropPrivileges } from '../src/privileges.js';

const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'meeple-'));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('loadConfig', () => {
  const base = { DISCORD_TOKEN: 't', DISCORD_CLIENT_ID: 'c' };

  it('derives the backup folder and disables optional features by default', () => {
    const config = loadConfig({ ...base, DATABASE_PATH: '/data/bot.db' });
    expect(config.backupDir?.replaceAll('\\', '/')).toBe('/data/backups');
    expect(config.backupKeep).toBe(7);
    expect(config.healthPort).toBeNull();
    expect(loadConfig({ ...base, BACKUP_KEEP: '0' }).backupDir).toBeNull();
    expect(loadConfig({ ...base, HEALTH_PORT: '8080' }).healthPort).toBe(8080);
  });

  it('rejects invalid values', () => {
    expect(() => loadConfig({ ...base, TIMEZONE: 'Mars/Olympus' })).toThrow(/TIMEZONE/);
    expect(() => loadConfig({ ...base, BACKUP_KEEP: '-1' })).toThrow(/BACKUP_KEEP/);
    expect(() => loadConfig({ DISCORD_TOKEN: 't' })).toThrow(/DISCORD_CLIENT_ID/);
  });
});

describe('backupDatabase', () => {
  it('writes one copy a day and keeps the latest ones', async () => {
    const dir = tempDir();
    const db = createDb(join(dir, 'bot.db'));
    const backups = join(dir, 'backups');
    for (const day of ['01', '02', '03']) {
      await backupDatabase(db, backups, 2, new Date(`2026-10-${day}T12:00:00Z`));
    }
    expect(await backupDatabase(db, backups, 2, new Date('2026-10-03T18:00:00Z'))).toBeNull();
    writeFileSync(join(backups, 'notes.txt'), 'kept');
    expect(readdirSync(backups).sort()).toEqual([
      'bot-2026-10-02.db',
      'bot-2026-10-03.db',
      'notes.txt',
    ]);
    const copy = createDb(join(backups, 'bot-2026-10-03.db'));
    expect(copy.$client.prepare('select count(*) as n from games').get()).toEqual({ n: 0 });
    copy.$client.close();
    db.$client.close();
  });
});

describe('health', () => {
  it('answers 200 when ready and 503 otherwise', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let ready = true;
    const client = { isReady: () => ready, ws: { ping: 42 } } as unknown as Client;
    const server = startHealthServer(client, 0);
    await new Promise((resolve) => server.once('listening', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const ok = await fetch(`${url}/health`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ status: 'ok', ping: 42 });
    ready = false;
    expect((await fetch(`${url}/health`)).status).toBe(503);
    expect((await fetch(`${url}/other`)).status).toBe(404);
    server.close();
  });

  it('exits when the gateway stays down too long', () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = vi.fn();
    const stop = startWatchdog({ isReady: () => false } as Client, 60_000, exit);
    vi.advanceTimersByTime(60_000);
    expect(exit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30_000);
    expect(exit).toHaveBeenCalledWith(1);
    stop();
  });
});

describe('dropPrivileges', () => {
  it('does nothing without a target user or outside root', () => {
    const dir = tempDir();
    expect(dropPrivileges(dir, {})).toBe(false);
    expect(dropPrivileges(dir, { RUN_AS_UID: '1000', RUN_AS_GID: '1000' })).toBe(
      process.getuid?.() === 0,
    );
    expect(existsSync(dir)).toBe(true);
  });
});
