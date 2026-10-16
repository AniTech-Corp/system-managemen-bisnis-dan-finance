export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith('[')) {
    return normalized.startsWith('[::1]') && (normalized.length === 5 || normalized[5] === ':');
  }
  const hostname = normalized.split(':', 1)[0];
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export function isLocalDemoRequest(host: string, nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv !== 'production' && isLoopbackHost(host);
}
