// Entry point for panel hosts (Pterodactyl, e.g. KataBump) that run `node index.js` and offer no
// way to set environment variables: loads .env if present, then starts the compiled bot.
// The import is dynamic so that it runs after the variables are loaded.
import { existsSync } from 'node:fs';

const env = new URL('.env', import.meta.url);
if (existsSync(env)) process.loadEnvFile(env);
await import('./dist/index.js');
