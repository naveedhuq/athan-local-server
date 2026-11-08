import { networkInterfaces } from 'node:os';
import type { Config } from './config.js';

/** Best guess at this machine's LAN address, which speakers must be able to reach. */
export function lanAddress(): string {
  const candidates: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) if (a.family === 'IPv4' && !a.internal) candidates.push(a.address);
  }
  const rank = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  return candidates.sort((a, b) => rank(a) - rank(b))[0] ?? '127.0.0.1';
}

export function baseUrl(cfg: Config, port: number): string {
  // PUBLIC_URL (env) wins: containers can't see the host's LAN address themselves.
  const custom = process.env.PUBLIC_URL?.trim() || cfg.server.publicUrl?.trim();
  return (custom ? custom : `http://${lanAddress()}:${port}`).replace(/\/+$/, '');
}
