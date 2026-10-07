// Builds a ready-to-upload archive for panel hosts (Pterodactyl, e.g. KataBump): the root
// index.js, the compiled bot, its migrations and the production dependencies, with the Linux x64
// binary of better-sqlite3 whatever the machine this runs on. Usage: `npm run pack:panel`.
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const STAGING = 'panel-build';
const ARCHIVE = 'meeple-night-panel.tar.gz';
// Node major of the panel's Docker image: native binaries depend on it, not on the local Node.
const NODE_TARGET = '24.0.0';

const run = (command, cwd = '.') => execSync(command, { cwd, stdio: 'inherit' });

rmSync(STAGING, { recursive: true, force: true });
mkdirSync(STAGING);
run('npm run build');
for (const path of ['index.js', 'package.json', 'package-lock.json', 'dist', 'drizzle']) {
  cpSync(path, join(STAGING, path), { recursive: true });
}
// Install scripts would fetch the binary of this machine: the Linux one is fetched below.
run('npm ci --omit=dev --ignore-scripts', STAGING);
const prebuild = resolve(STAGING, 'node_modules/prebuild-install/bin.js');
run(
  `node "${prebuild}" --platform=linux --arch=x64 --runtime=node --target=${NODE_TARGET}`,
  join(STAGING, 'node_modules/better-sqlite3'),
);
run(`tar -czf ${ARCHIVE} -C ${STAGING} .`);
rmSync(STAGING, { recursive: true, force: true });
console.log(`\n${ARCHIVE} ready: upload it next to .env, then unarchive it.`);
