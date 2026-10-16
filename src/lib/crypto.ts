import crypto from 'crypto';

/**
 * Enkripsi field data sensitif pelanggan (AES-256-GCM) — checklist keamanan Mas Zulfi.
 * Kunci diambil dari env KLIR_ENCRYPTION_KEY (32 byte / 64 hex). TIDAK ada kunci hardcoded.
 * Format tersimpan: "enc:v1:" + base64(iv[12] | authTag[16] | ciphertext).
 * Toleran: nilai lama/plaintext (tanpa prefix) dikembalikan apa adanya (tidak merusak data lama).
 */
const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

function getKey(): Buffer | null {
  const hex = process.env.KLIR_ENCRYPTION_KEY;
  if (!hex) return null;
  try {
    const key = Buffer.from(hex, 'hex');
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function encryptField(plain: string): string;
export function encryptField(plain: null): null;
export function encryptField(plain: undefined): undefined;
export function encryptField(plain?: string | null): string | null | undefined;
export function encryptField(plain?: string | null): string | null | undefined {
  if (plain === null || plain === undefined || plain === '') return plain;
  const key = getKey();
  if (!key) return plain; // fail-safe: tanpa kunci, simpan apa adanya (dev)
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptField(stored: string): string;
export function decryptField(stored: null): null;
export function decryptField(stored: undefined): undefined;
export function decryptField(stored?: string | null): string | null | undefined;
export function decryptField(stored?: string | null): string | null | undefined {
  if (stored === null || stored === undefined || stored === '') return stored;
  if (!String(stored).startsWith(PREFIX)) return stored; // legacy/plaintext
  const key = getKey();
  if (!key) return stored;
  try {
    const raw = Buffer.from(String(stored).slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  } catch {
    return stored;
  }
}

/** Dekripsi beberapa field pada satu objek (mengembalikan salinan dangkal). */
export function decryptFields<T extends Record<string, any>>(obj: T, fields: string[]): T {
  if (!obj) return obj;
  const clone: any = { ...obj };
  for (const f of fields) {
    if (clone[f] != null) clone[f] = decryptField(clone[f]);
  }
  return clone as T;
}
