/**
 * Backend search rules (guide §7.2): names need ≥ 2 letters, phone numbers ≥ 3 digits
 * (prefix match). Shorter input must not be sent — the API answers 422.
 */
export interface SearchResult {
  /** Value safe to send to the API, or undefined to omit the param. */
  value?: string;
  /** Inline hint shown while the input is too short. */
  hint?: string;
}

const PHONE_LIKE = /^[+\d\s\-()]+$/;

export function normalizeSearch(raw: string, options: { allowPhone?: boolean } = {}): SearchResult {
  const allowPhone = options.allowPhone ?? true;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return {};

  if (allowPhone && PHONE_LIKE.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 3) return { hint: 'Type at least 3 digits to search by phone number.' };
    return { value: digits };
  }

  const letters = trimmed.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2) return { hint: 'Type at least 2 letters to search by name.' };
  return { value: trimmed };
}
