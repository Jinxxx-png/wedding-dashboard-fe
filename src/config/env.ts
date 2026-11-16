/**
 * Runtime configuration resolved from Vite environment variables.
 * Never hardcode production API URLs — configure VITE_API_BASE_URL per environment.
 */
function resolveApiBaseUrl(): string {
  const explicit = import.meta.env.VITE_API_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  // Backward compatible with the backend guide's VITE_API_URL (origin only).
  const origin = import.meta.env.VITE_API_URL?.trim();
  if (origin) return `${origin.replace(/\/+$/, '')}/api/v1`;

  // Same-origin default (Vite dev proxy or reverse proxy in production).
  return '/api/v1';
}

export const env = {
  apiBaseUrl: resolveApiBaseUrl(),
  /** Mock API is only ever allowed in development builds. */
  useMocks: import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true',
  isDev: import.meta.env.DEV,
} as const;
