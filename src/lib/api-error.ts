/**
 * Boundary pesan error API.
 *
 * Detail Prisma/provider hanya boleh masuk log server. Client menerima pesan
 * stabil yang bisa ditindaklanjuti tanpa membocorkan nama tabel, constraint,
 * path filesystem, atau response provider.
 */
export function publicApiError(fallback: string): string {
  return fallback;
}
