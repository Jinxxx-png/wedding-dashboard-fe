# Wedding Project — Dashboard (frontend)

Customer and admin dashboard for the Wedding Project platform. It is a standalone React SPA that talks **only** to the
separate Golang REST API (`/api/v1`). There is no backend code, no database and no Firestore access in this project:
the backend owns authentication, authorization, tenant isolation, exports and business logic.

- **Stack:** React 19, TypeScript (strict), Vite 7, Tailwind CSS v4, shadcn/ui (new-york, on Radix), React Router 7,
  TanStack Query 5, Axios, Recharts 3, Lucide, React Hook Form + Zod, Sonner, Vitest + Testing Library.
- **API contract:** `FRONTEND_DASHBOARD_GUIDE.md` (backend Swagger at `{API_URL}/api/docs`).
- **Product brief:** `objective.txt`.

---

## Quick start

```bash
npm install
cp .env.example .env.local      # adjust VITE_API_BASE_URL if needed
npm run dev                     # http://localhost:5173 (proxies /api → http://localhost:8080)
```

Run the Go backend locally (see the backend README), e.g. with the in-memory driver:

```bash
DATABASE_DRIVER=memory BOOTSTRAP_ADMIN_USERNAME=admin BOOTSTRAP_ADMIN_PASSWORD='a-long-dev-passphrase' go run ./cmd/api
```

The backend's `FRONTEND_URL` must contain the dashboard origin (default `http://localhost:5173`).

### Without the backend: mock mode (development only)

```bash
npm run dev:mock
```

Loads `.env.mock` (`VITE_USE_MOCKS=true`) and installs an **in-memory mock API** as an Axios adapter
(`src/mocks/`). It follows the documented contract: response envelopes, CSRF, restricted sessions,
422 rules, pagination, exports. That lets you build the UI without the Go server.

| Account | Username | Password | Notes |
|---|---|---|---|
| Admin | `admin` | `admin-dev-passphrase` | |
| Customer (2 websites) | `luqman` | `customer-dev-passphrase` | Shows the website selector |
| Customer (temporary password) | `sarah` | `abacus-ladder-mosaic-velvet-orbit-prism-harbor-quill` | Forced to `/setup-password` |
| Customer (disabled) | `daniel` | `customer-dev-passphrase` | Login is refused |

Mock data lives in memory and **resets on a full page reload**. The signed-in mock user is kept in `sessionStorage`
(mock only). Mock "XLSX" exports are CSV files named `*.mock-xlsx.csv`. Mocks are never used in production builds:
`env.useMocks` requires `import.meta.env.DEV`, and the mock module is excluded from `dist/`.

---

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with `/api` proxy |
| `npm run dev:mock` | Dev server + in-memory mock API |
| `npm run typecheck` | `tsc -b` (strict) |
| `npm test` | Vitest (jsdom) |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build |

## Configuration

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Full API base **including** `/api/v1`, e.g. `https://api.example.com/api/v1`. Empty → same-origin `/api/v1`. |
| `VITE_API_URL` | Alternative from the backend guide: API origin only (`/api/v1` is appended). Used if `VITE_API_BASE_URL` is empty. |
| `VITE_DEV_PROXY_TARGET` | Dev proxy target for `/api` (default `http://localhost:8080`). |
| `VITE_USE_MOCKS` | `true` enables the mock API in **development builds only**. |

Production URLs are never hardcoded.

### Production cookie setup

Authentication uses the backend's **HTTP-only session cookie** (`wp_session`) with `withCredentials: true`.

- **Recommended:** serve the dashboard and API on the same site. Either proxy `/api` through the dashboard host and leave
  `VITE_API_BASE_URL` empty, or use `app.example.com` + `api.example.com`. Backend settings: `COOKIE_SECURE=true`,
  `COOKIE_SAMESITE=lax`.
- Cross-site deployments need `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true`. Some browsers (Safari) may still block these cookies.
- For cross-origin deployments the backend must send `Access-Control-Expose-Headers: Content-Disposition`.
  Otherwise exports fall back to the frontend's filenames.

---

## Architecture

```
src/
  config/env.ts            Environment resolution (API base URL, mock flag)
  types/api.ts             TypeScript interfaces mirroring the API contract
  services/
    api.ts                 Axios client: envelope unwrapping, ApiError, CSRF, 401/expiry handling, downloads
    auth.service.ts        login / me / logout / logout-all / password setup & change
    customer.service.ts    /customer/* (website-scoped endpoints, also used by admins)
    admin.service.ts       /admin/*
    export.service.ts      Backend exports + meaningful fallback filenames
  contexts/
    AuthContext.tsx        Session state, route-by-role, expiry timer, global auth events
    WebsiteContext.tsx     Customer's selected website (persisted in the URL as ?site=<id>)
  routes/                  Route table (lazy-loaded pages) + guards (RequireAuth / RequireRole / RequirePasswordSetup / GuestOnly)
  layouts/                 AuthLayout, CustomerLayout, AdminLayout, shared DashboardShell
  pages/                   auth/, customer/, admin/, errors/
  features/                Reusable domain modules shared by customer & admin pages
    analytics/             KPI tiles, attendance summary, chart cards, query hooks
    rsvps/                 Filters hook, table (+ mobile cards), detail / edit / delete
    wishes/                Filters, card grid, moderation actions
    guests/                Guest list derived from RSVP guestDetails
    websites/              RSVP & wish settings form
    account/               Change password, preferences, log out everywhere
    admin/                 Create/edit customer & website, account actions, directories, audit helpers
  components/
    ui/                    shadcn/ui primitives
    charts/                Recharts components (validated colour-blind-safe palette)
    tables/                Pagination, sortable headers, skeletons
    forms/                 FormField, PasswordInput, SearchInput, DateRangeFilter, SegmentedControl
    shared/                PageHeader, StatCard, Empty/Error states, ConfirmDialog, ExportMenu, OneTimeSecretDialog, badges
  hooks/  utils/  lib/     Debounce, page size preference, invalidation, formatting, error mapping, query client & keys
  mocks/                   DEV-ONLY mock API (never bundled for production)
  test/  __tests__/        Test setup, fixtures, render helpers and test suites
```

### Key behaviours

- **Auth flow:** `GET /auth/me` on start. Restricted sessions (`mustChangePassword`) can only reach `/setup-password`.
  Admins land on `/admin/dashboard`, customers on `/dashboard`.
- **CSRF:** the token is held **in memory only** and sent as `X-CSRF-Token` on POST/PUT/PATCH/DELETE. A stale token
  (`CSRF_INVALID`) is refreshed through `/auth/me` and the request is retried once.
- **Expiry:** on a 401 the app clears state and shows the login page with "Your session has expired". Any later
  requests are short-circuited until the user signs in again. A client-side timer also signs out at `sessionExpiresAt`.
- **No secrets in storage:** passwords, session ids, CSRF tokens and one-time secrets are never written to
  `localStorage` or `sessionStorage`. `localStorage` only stores the sidebar collapsed preference.
- **Submissions vs guests:** RSVP *forms* and *guests* are always labelled and computed separately, using the backend
  analytics values. They are never derived client-side.
- **Server-side lists:** search (debounced; min 2 letters / 3 digits), status, date range, sort and pagination are
  all API parameters. Date ranges disable non-`createdAt` sorts, as the API requires.
- **Exports:** a reusable `ExportMenu` (Excel / CSV). It forwards the active filters, shows progress and errors, and
  saves the file using the server filename, falling back to names like `luqman-amin-rsvp.xlsx`.
- **One-time secrets:** temporary passwords and signing secrets appear once in a dialog with a copy button and a
  delivery warning. They live only in component state and are discarded on close.
- **Strict request bodies:** forms send only changed or documented fields (the API rejects unknown keys with 422).
  Server field errors (`details[].field`) are mapped onto form fields.
- **Wishes** are rendered as plain text (`white-space: pre-wrap`), never as HTML.

### Implementation notes and assumptions

- **HTTP client:** the guide ships a `fetch` client. The brief requires Axios, so `services/api.ts` reimplements the
  same behaviour (credentials, CSRF retry, error normalisation, 401 / `PASSWORD_CHANGE_REQUIRED` events, downloads) on Axios.
- **Customer URLs:** the brief requires `/dashboard`, and the guide suggests keeping the website in the URL. Customer
  pages live at `/dashboard/*` with `?site=<websiteId>`.
- **Guest management:** there is no guest endpoint. Guests are flattened from each RSVP's `guestDetails`, so
  pagination is per RSVP. RSVPs without details show the main guest plus a count of unnamed guests; nothing is invented.
- **Admin "customer" filter** (All RSVPs / All Wishes): the API filters by `websiteId` only. Choosing a customer narrows
  the website list to that customer's websites and selects the first one.
- **Admin overview:** "Active customers" comes from `GET /admin/users?role=customer&accountStatus=active`
  (`meta.totalItems`). "Latest customers" sorts the first page client-side, because the users endpoint has no
  documented sort parameter.
- **Per-customer stats** on the Customers page come from summing `GET /admin/analytics` → `websites[]` per website.
- **Not built (per the guide):** email login, self sign-up, forgot-password emails, deleting users or websites,
  file uploads, real-time push.

---

## Testing

`npm test` runs 48 tests in 7 suites:

| Area | Suite |
|---|---|
| API error handling, CSRF retry, 401 short-circuit, filename parsing | `api-client.test.ts` |
| Login, redirects by role, password setup validation | `auth.test.tsx` |
| Protected routes, role-based navigation | `routing.test.tsx` |
| Analytics rendering (forms vs guests), empty states, website selector | `customer-dashboard.test.tsx` |
| RSVP search / status / date / sort / pagination / detail | `rsvp-management.test.tsx` |
| Export menu, filters and filenames, browser download | `exports.test.tsx` |
| Admin customer management (create + one-time password, reset, disable) | `admin-customers.test.tsx` |

The setup (`src/test/setup.ts`) includes small jsdom shims: in-memory Web Storage (Node ≥ 25 shadows jsdom's) and a
`Request` wrapper (React Router passes jsdom's AbortSignal to Node's Request).

## Roadmap status

| Phase | Status |
|---|---|
| 1. Project initialisation & design system | ✅ |
| 2. Authentication & protected routes | ✅ |
| 3. Customer dashboard | ✅ |
| 4. RSVP management | ✅ |
| 5. Wishes management | ✅ |
| 6. Attendance analytics | ✅ |
| 7. Excel & CSV export | ✅ |
| 8. Admin dashboard | ✅ |
| 9. Customer & website management | ✅ |
| 10. Global management, audit logs & testing | ✅ |

Next steps: verify against the running Go backend and its OpenAPI spec (field names, `Content-Disposition`
exposure, users sort order). Add Playwright end-to-end tests against the backend's memory driver.
