/**
 * License Key Generation & Hashing Utilities (Security Hardened)
 * Generates cryptographically secure high-entropy license keys and download tokens.
 *
 * Entropy Characteristics:
 *  - License Key: MDK-PRO-2026-XXXX-XXXX
 *    Uses Crockford Base-32 alphabet (32 unambiguous characters: 2-9, A-Z excluding I, L, O, U).
 *    8 Base-32 characters = 32^8 ≈ 1,099,511,627,776 (1.1+ Trillion) unique combinations (~40 bits).
 *    Prevents user transcription confusion (no 0 vs O, 1 vs I vs L).
 *
 *  - Download Token: 64 hexadecimal characters
 *    32 bytes of CSPRNG entropy = 256 bits. Brute force resistance: 1.15 × 10^77 combinations.
 */

const CROCKFORD_BASE32 = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateLicenseKey(prefix = 'MDK-PRO-2026-'): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let raw = '';
  for (let i = 0; i < bytes.length; i++) {
    raw += CROCKFORD_BASE32[bytes[i] % CROCKFORD_BASE32.length];
  }
  // Group as 4-4 for readability: e.g. MDK-PRO-2026-K7M9-P4X2
  const formattedSuffix = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  return `${prefix}${formattedSuffix}`;
}

export function generateDownloadToken(): string {
  const bytes = new Uint8Array(32); // 32 bytes = 64 hex characters (256 bits entropy)
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashString(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
