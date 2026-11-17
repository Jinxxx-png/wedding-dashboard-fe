/** Human-readable labels for audit log actions (guide §8.9). */
export const AUDIT_ACTIONS: Record<string, string> = {
  'auth.login.success': 'Signed in',
  'auth.login.failed': 'Failed sign-in',
  'auth.login.locked': 'Account locked',
  'auth.logout': 'Signed out',
  'auth.logout_all': 'Signed out everywhere',
  'auth.password.setup': 'Password set up',
  'auth.password.change': 'Password changed',
  'admin.bootstrap': 'Admin bootstrapped',
  'admin.user.create': 'Account created',
  'admin.user.update': 'User updated',
  'admin.user.reset_password': 'Password reset',
  'admin.user.disable': 'User disabled',
  'admin.user.activate': 'User activated',
  'admin.user.revoke_sessions': 'Sessions revoked',
  'admin.user.assign_websites': 'Websites assigned',
  'admin.user.role_change': 'Role changed',
  'admin.website.create': 'Website created',
  'admin.website.update': 'Website updated',
  'admin.website.slug_change': 'Slug changed',
  'admin.website.owner_change': 'Owner changed',
  'admin.website.rotate_secret': 'Signing secret rotated',
  'admin.website.recompute_stats': 'Statistics recomputed',
  'website.settings.update': 'Website settings updated',
  'rsvp.update': 'RSVP updated',
  'rsvp.delete': 'RSVP deleted',
  'wish.update': 'Wish updated',
  'wish.delete': 'Wish deleted',
  'data.export': 'Data exported',
  'user.settings.update': 'Preferences updated',
};

const SENSITIVE_KEY = /pass(word)?|secret|token|hash|csrf|cookie|session_?id|authorization/i;

/** Defensive redaction: never render credential-like metadata even if the backend sent it. */
export function safeMetadata(metadata: Record<string, unknown> | null | undefined): [string, string][] {
  return Object.entries(metadata ?? {}).map(([k, v]) => {
    if (SENSITIVE_KEY.test(k)) return [k, '[redacted]'];
    if (v === null || v === undefined) return [k, '—'];
    if (typeof v === 'object') return [k, JSON.stringify(v)];
    return [k, String(v)];
  });
}
