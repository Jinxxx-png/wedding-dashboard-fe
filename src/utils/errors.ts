import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError, isApiError } from '@/services/api';

/** User-facing message for any error, following the backend error table (guide §9). */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!isApiError(error)) return error instanceof Error && error.message ? error.message : fallback;

  switch (error.code) {
    case 'RATE_LIMITED':
      return error.retryAfter
        ? `Too many attempts. Try again in ${error.retryAfter} seconds.`
        : 'Too many attempts. Please wait a moment and try again.';
    case 'ACCOUNT_LOCKED':
      return 'Too many failed attempts. Try again in 15 minutes.';
    case 'PAYLOAD_TOO_LARGE':
      return 'Too much data was sent. Please reduce the size and try again.';
    case 'SERVICE_UNAVAILABLE':
      return 'Service temporarily unavailable. Please retry in a moment.';
    case 'FORBIDDEN':
      return "You don't have access to this resource.";
    case 'UNAUTHORIZED':
      return 'Your session has expired. Please sign in again.';
    case 'INTERNAL_ERROR':
      return error.requestId
        ? `Something went wrong on our side. Reference: ${error.requestId}`
        : 'Something went wrong on our side. Please try again.';
    case 'VALIDATION_ERROR':
      if (error.details.length > 0) {
        return error.details.map((d) => `${d.field}: ${d.message}`).join('\n');
      }
      return error.message || 'Please check the highlighted fields.';
    default:
      return error.message || fallback;
  }
}

/** Login-specific messages (guide §5.2). Unknown users and wrong passwords look identical. */
export function getLoginErrorMessage(error: unknown): string {
  if (!isApiError(error)) return getErrorMessage(error);
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'Incorrect username or password.';
    case 'TEMP_PASSWORD_EXPIRED':
      return 'Your temporary password expired. Ask the administrator to reset it.';
    case 'ACCOUNT_DISABLED':
      return 'This account has been disabled.';
    case 'ACCOUNT_LOCKED':
      return 'Too many failed attempts. Try again in 15 minutes.';
    case 'RATE_LIMITED':
      return error.retryAfter
        ? `Too many attempts. Try again in ${error.retryAfter} seconds.`
        : 'Too many attempts. Please wait and try again.';
    case 'CSRF_INVALID':
      return 'This dashboard origin is not allowed by the server (CSRF check failed). Contact your administrator.';
    case 'VALIDATION_ERROR':
      return 'Please enter your username and password.';
    default:
      return getErrorMessage(error);
  }
}

/**
 * Maps `422 VALIDATION_ERROR` details (and 409 conflicts) onto react-hook-form fields.
 * `fieldMap` translates backend paths (e.g. `websiteSlug`) to form field names.
 * Returns messages that could not be attached to a field.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  options: { fields: readonly string[]; fieldMap?: Record<string, string>; conflictMap?: Record<string, string> },
): string[] {
  if (!isApiError(error)) return [getErrorMessage(error)];
  const unmatched: string[] = [];
  const known = new Set(options.fields);

  const conflictField = options.conflictMap?.[error.code];
  if (conflictField && known.has(conflictField)) {
    setError(conflictField as Path<T>, { type: 'server', message: error.message });
    return [];
  }

  if (error.details.length === 0) return [getErrorMessage(error)];

  const grouped = error.fieldErrors();
  for (const [backendField, message] of Object.entries(grouped)) {
    const mapped = options.fieldMap?.[backendField] ?? backendField;
    // Support nested paths like guestDetails[1].name → guestDetails.1.name
    const normalized = mapped.replace(/\[(\d+)\]/g, '.$1');
    const root = normalized.split('.')[0] ?? normalized;
    if (known.has(normalized) || known.has(root)) {
      setError(normalized as Path<T>, { type: 'server', message });
    } else {
      unmatched.push(`${backendField}: ${message}`);
    }
  }
  return unmatched;
}

export function notifyError(error: unknown, title?: string) {
  const message = getErrorMessage(error);
  if (title) toast.error(title, { description: message });
  else toast.error(message);
}

export function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

export function isForbidden(error: unknown): boolean {
  return isApiError(error) && error.status === 403 && error.code !== 'PASSWORD_CHANGE_REQUIRED';
}

export { ApiError };
