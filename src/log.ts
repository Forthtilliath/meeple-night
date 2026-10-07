type Level = 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

/** Turns errors into plain objects: JSON.stringify drops their (non-enumerable) fields. */
function serialize(value: unknown): unknown {
  if (!(value instanceof Error)) return value;
  const { name, message, stack } = value;
  const code = (value as { code?: unknown }).code;
  return { name, message, ...(code === undefined ? {} : { code }), stack };
}

function write(level: Level, message: string, fields: LogFields = {}): void {
  const entry: LogFields = { time: new Date().toISOString(), level, msg: message };
  for (const [key, value] of Object.entries(fields)) entry[key] = serialize(value);
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else console.log(line);
}

/** One JSON object per line: readable with `fly logs` and easy to filter (guild, command…). */
export const log = {
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
};
