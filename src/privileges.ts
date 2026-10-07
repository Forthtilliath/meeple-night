import { chownSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { log } from './log.js';

function chownTree(path: string, uid: number, gid: number): void {
  chownSync(path, uid, gid);
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) chownTree(child, uid, gid);
    else chownSync(child, uid, gid);
  }
}

/**
 * In the container, the process starts as root only because the host mounts the data volume
 * as root: it hands the data folder to RUN_AS_UID/RUN_AS_GID, then gives up root for good,
 * before opening the database or any connection. A no-op elsewhere (dev, Windows, non-root).
 */
export function dropPrivileges(dataDir: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const uid = Number(env.RUN_AS_UID);
  const gid = Number(env.RUN_AS_GID);
  if (!uid || !gid || process.getuid?.() !== 0) return false;
  mkdirSync(dataDir, { recursive: true });
  chownTree(dataDir, uid, gid);
  process.setgroups?.([]);
  process.setgid?.(gid);
  process.setuid?.(uid);
  log.info('Dropped root privileges', { uid, gid });
  return true;
}
