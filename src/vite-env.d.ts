/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full API base URL including `/api/v1`, e.g. http://localhost:8080/api/v1. Empty → same-origin `/api/v1`. */
  readonly VITE_API_BASE_URL?: string;
  /** Alternative from the backend guide: API origin without the `/api/v1` suffix. */
  readonly VITE_API_URL?: string;
  /** Development only: `true` enables the in-memory mock API. Ignored in production builds. */
  readonly VITE_USE_MOCKS?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
