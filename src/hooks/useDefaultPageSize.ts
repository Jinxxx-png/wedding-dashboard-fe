import { useAuth } from '@/contexts/AuthContext';

/** The user's preferred page size (account settings), constrained to the API range 5–100. */
export function useDefaultPageSize(fallback = 20): number {
  const { user } = useAuth();
  const preferred = user?.settings.defaultPageSize ?? 0;
  if (preferred >= 5 && preferred <= 100) return preferred;
  return fallback;
}
