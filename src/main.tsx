import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { env } from '@/config/env';
import { api } from '@/services/api';

async function bootstrap() {
  // Development-only mock API for visual work without the Go backend.
  // `env.useMocks` is always false in production builds, so the mock module is never bundled/used there.
  if (env.useMocks) {
    const { installMockApi } = await import('./mocks');
    installMockApi(api);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
