import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { AppProviders } from '@/AppProviders';
import { routes } from '@/routes';
import { authService } from '@/services/auth.service';
import { ApiError, markSessionActive, setCsrfToken } from '@/services/api';
import type { MeResponse } from '@/types/api';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity }, mutations: { retry: false } },
  });
}

/**
 * Renders the full application router at `path`. `me` controls the initial session probe:
 * a MeResponse signs the user in, `null` means "not signed in" (401).
 */
export function renderApp(path: string, { me }: { me: MeResponse | null }) {
  markSessionActive();
  setCsrfToken(null);
  if (me) vi.spyOn(authService, 'me').mockResolvedValue(me);
  else vi.spyOn(authService, 'me').mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'authentication required'));

  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  const utils = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, router, queryClient, user };
}

/** Renders a component with providers + a MemoryRouter (for isolated component tests). */
export function renderWithProviders(ui: ReactElement, { path = '/', me }: { path?: string; me?: MeResponse | null } = {}) {
  markSessionActive();
  if (me) vi.spyOn(authService, 'me').mockResolvedValue(me);
  else vi.spyOn(authService, 'me').mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'authentication required'));
  const queryClient = createTestQueryClient();
  const user = userEvent.setup();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </AppProviders>
  );
  return { ...render(ui, { wrapper: Wrapper }), queryClient, user };
}
