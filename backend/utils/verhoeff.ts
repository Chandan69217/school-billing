/**
 * Verhoeff checksum algorithm for Indian UIDAI Aadhaar Number Validation
 */

const d: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const p: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

export function validateVerhoeff(numStr: string): boolean {
  if (!numStr || !/^\d+$/.test(numStr)) return false;
  let c = 0;
  const inverted = numStr.split('').map(Number).reverse();
  for (let i = 0; i < inverted.length; i++) {
    c = d[c][p[i % 8][inverted[i]]];
  }
  return c === 0;
}

export function validateAadhaar(aadhaar: string | null | undefined, isRequired = false): { valid: boolean; message?: string } {
  if (!aadhaar) {
    if (isRequired) return { valid: false, message: 'Aadhaar number is required' };
    return { valid: true };
  }

  const cleaned = String(aadhaar).replace(/\s+/g, '');
  if (!/^\d{12}$/.test(cleaned)) {
    return { valid: false, message: 'Aadhaar must be exactly 12 digits (digits only)' };
  }
  if (cleaned.startsWith('0') || cleaned.startsWith('1')) {
    return { valid: false, message: 'Aadhaar cannot start with 0 or 1' };
  }
  if (!validateVerhoeff(cleaned)) {
    return { valid: false, message: 'Invalid Aadhaar checksum (Verhoeff check failed)' };
  }
  return { valid: true };
}

export function formatAadhaar(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  const parts = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

export function maskAadhaar(raw: string | null | undefined): string {
  if (!raw) return '—';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return digits;
  const last4 = digits.slice(-4);
  return `XXXX XXXX ${last4}`;
}

export function cleanAadhaarDigits(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw).replace(/\D/g, '').slice(0, 12);
}

export const validateAadhaarNumber = validateAadhaar;

