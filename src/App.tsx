import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/AppProviders';
import { createQueryClient } from '@/lib/query';
import { routes } from '@/routes';

const router = createBrowserRouter(routes);

export default function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
