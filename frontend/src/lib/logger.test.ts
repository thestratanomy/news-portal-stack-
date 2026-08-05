import { describe, expect, it, vi } from 'vitest';
import { logError, logInfo } from './logger';

describe('logger', () => {
  it('logInfo writes a JSON line to stdout with level=info', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logInfo('hello', { foo: 'bar' });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse((spy.mock.calls[0][0] as string).trim());
    expect(line).toMatchObject({ level: 'info', msg: 'hello', foo: 'bar' });
    spy.mockRestore();
  });

  it('logError writes a JSON line to stderr with level=error', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logError('oops', { code: 500 });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse((spy.mock.calls[0][0] as string).trim());
    expect(line).toMatchObject({ level: 'error', msg: 'oops', code: 500 });
    spy.mockRestore();
  });
});
