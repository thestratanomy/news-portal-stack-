type LogMeta = Record<string, unknown>;

function writeLine(stream: NodeJS.WriteStream, level: 'info' | 'error', msg: string, meta?: LogMeta) {
  const payload = { level, msg, ...meta };
  stream.write(JSON.stringify(payload) + '\n');
}

export function logInfo(msg: string, meta?: LogMeta): void {
  writeLine(process.stdout, 'info', msg, meta);
}

export function logError(msg: string, meta?: LogMeta): void {
  writeLine(process.stderr, 'error', msg, meta);
}
