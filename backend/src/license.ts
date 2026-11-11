/**
 * License Key Generation & Hashing Utilities
 * Generates cryptographically secure 16-character keys (e.g. MDK-PRO-2026-A1B2C3)
 */

export function generateLicenseKey(prefix = 'MDK-PRO-2026-'): string {
  const bytes = new Uint8Array(3); // 3 bytes = 6 hex characters
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `${prefix}${suffix}`;
}

export function generateDownloadToken(): string {
  const bytes = new Uint8Array(32); // 32 bytes = 64 hex characters
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
