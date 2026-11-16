import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Lazy-loaded route modules can take a moment to import on a cold run.
configure({ asyncUtilTimeout: 5000 });

// Node ≥ 25 exposes its own (unconfigured) Web Storage globals that shadow jsdom's.
// Provide a simple in-memory Storage so code under test behaves like in a browser.
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}
for (const key of ['localStorage', 'sessionStorage'] as const) {
  let usable = false;
  try {
    usable = typeof globalThis[key]?.getItem === 'function';
  } catch {
    usable = false;
  }
  if (!usable) {
    const storage = memoryStorage();
    Object.defineProperty(globalThis, key, { value: storage, configurable: true, writable: true });
    Object.defineProperty(window, key, { value: storage, configurable: true, writable: true });
  }
}

// React Router creates `Request` objects with jsdom's AbortSignal, which Node's undici
// Request rejects. Attach the signal after construction instead.
const NodeRequest = globalThis.Request;
class TestRequest extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    const signal = init?.signal;
    super(input, init ? { ...init, signal: undefined } : init);
    if (signal) Object.defineProperty(this, 'signal', { value: signal });
  }
}
globalThis.Request = TestRequest as typeof Request;

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});

// ---- jsdom polyfills used by Radix UI and Recharts ----
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

Element.prototype.scrollIntoView ??= vi.fn();
Element.prototype.hasPointerCapture ??= vi.fn(() => false);
Element.prototype.setPointerCapture ??= vi.fn();
Element.prototype.releasePointerCapture ??= vi.fn();

// URL.createObjectURL is not implemented in jsdom (used by downloads).
URL.createObjectURL ??= vi.fn(() => 'blob:mock');
URL.revokeObjectURL ??= vi.fn();
