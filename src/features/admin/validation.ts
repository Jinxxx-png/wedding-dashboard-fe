import { z } from 'zod';

/** Client-side mirrors of the backend validation rules (guide §8.3). Server stays authoritative. */
export const RESERVED_SLUGS = ['api', 'admin', 'www', 'public', 'static', 'assets', 'dashboard'];

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Must be at least 3 characters')
  .max(32, 'Must be at most 32 characters')
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Letters, digits, . _ - only; must start with a letter or digit');

export const slugSchema = z
  .string()
  .trim()
  .min(3, 'Must be at least 3 characters')
  .max(63, 'Must be at most 63 characters')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, digits and single hyphens (e.g. ahmad-sarah)')
  .refine((v) => !RESERVED_SLUGS.includes(v), 'This slug is reserved');

export const urlSchema = z
  .string()
  .trim()
  .min(1, 'Website URL is required')
  .refine((v) => {
    try {
      const u = new URL(v);
      return (u.protocol === 'http:' || u.protocol === 'https:') && Boolean(u.hostname);
    } catch {
      return false;
    }
  }, 'Enter an absolute http(s):// URL');

export const optionalDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use YYYY-MM-DD');

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}
