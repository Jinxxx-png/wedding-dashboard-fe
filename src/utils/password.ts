import { z } from 'zod';

/**
 * Client-side mirror of the backend password policy (guide §5.4).
 * The server remains authoritative — its 422 messages are shown under the field too.
 */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export const PASSWORD_MIN_UNIQUE = 5;

const COMMON_PASSWORDS = new Set([
  'password1234',
  'password12345',
  'passwordpassword',
  '123456789012',
  '1234567890123',
  'qwertyuiopas',
  'qwerty123456',
  'iloveyou1234',
  'administrator',
  'letmein12345',
  'welcome12345',
  'changeme1234',
]);

export interface PasswordCheck {
  id: string;
  label: string;
  ok: boolean;
}

export function checkPassword(password: string, username?: string): PasswordCheck[] {
  const unique = new Set(password).size;
  return [
    { id: 'length', label: `${PASSWORD_MIN}–${PASSWORD_MAX} characters`, ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX },
    { id: 'unique', label: `At least ${PASSWORD_MIN_UNIQUE} different characters`, ok: unique >= PASSWORD_MIN_UNIQUE },
    {
      id: 'username',
      label: 'Does not contain your username',
      ok: !username || !password.toLowerCase().includes(username.toLowerCase()),
    },
    { id: 'spaces', label: 'No leading or trailing spaces', ok: password.length > 0 && password === password.trim() },
  ];
}

export function newPasswordSchema(username?: string) {
  return z
    .string()
    .min(PASSWORD_MIN, `Must be at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX, `Must be at most ${PASSWORD_MAX} characters`)
    .refine((v) => v === v.trim(), 'Must not start or end with a space')
    .refine((v) => new Set(v).size >= PASSWORD_MIN_UNIQUE, `Must contain at least ${PASSWORD_MIN_UNIQUE} different characters`)
    .refine((v) => !username || !v.toLowerCase().includes(username.toLowerCase()), 'Must not contain your username')
    .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), 'This password is too common');
}

export function setupPasswordSchema(username?: string) {
  return z
    .object({
      newPassword: newPasswordSchema(username),
      confirmPassword: z.string().min(1, 'Please confirm your new password'),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    });
}

export function changePasswordSchema(username?: string) {
  return z
    .object({
      currentPassword: z.string().min(1, 'Enter your current password'),
      newPassword: newPasswordSchema(username),
      confirmPassword: z.string().min(1, 'Please confirm your new password'),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    })
    .refine((v) => v.newPassword !== v.currentPassword, {
      path: ['newPassword'],
      message: 'Must differ from your current password',
    });
}
