# Backend changes required: relaxed password policy and account roles

> **Audience:** whoever works on the Go backend (a developer or an AI assistant).
> Hand over this whole file. It is self-contained.
> The dashboard frontend already implements both changes. It works fully once the backend does the following.
> Don't change anything else in the API contract.

---

## Change 1: relax the password policy

Users found the policy too strict for a wedding dashboard. Remove two rules and keep the rest.

### Remove
1. **"must contain at least 5 different characters"** (the minimum unique-characters check).
2. **"must not contain your username"** (case-insensitive username containment check).

### Keep (unchanged)
- Length 8–128 characters.
- The short blocklist of very common passwords (case-insensitive).
- No leading or trailing spaces.
- Setup: must differ from the temporary password. Change: must differ from the current password.
- `confirmPassword` must equal `newPassword`.
- The error format stays `422 VALIDATION_ERROR` with `details: [{ field: "newPassword", message: "…" }]`.

### Where
- The password validator (`validators/password.go`). Delete both checks, plus any constant or config value that only
  they use (e.g. a `MinUniqueChars` setting). If the validator takes a `username` argument only for the removed rule,
  drop the argument and update the callers (`POST /auth/password/setup`, `POST /auth/password/change`, and the
  bootstrap-admin password check, if it runs the policy).
- Update the validator's unit tests. Remove the cases for the two rules and add cases proving these are now accepted:
  - `luqman1111` for user `luqman` (contains the username)
  - `aaaabbbb` (only 2 different characters)
- Update the OpenAPI spec (`/api/docs/openapi.yaml`) and `API_ENDPOINTS.md` wherever the policy is described.

### Done when
- `POST /auth/password/setup` with `{ "newPassword": "luqman1111", "confirmPassword": "luqman1111" }` as user `luqman` → `200`.
- `POST /auth/password/change` with a new password of `aaaabbbb` → `200`.
- `password123` and `12345678` → still `422` (blocklist). `short` → still `422` (length). `" padded "` → still `422` (spaces).

---

## Change 2: new endpoint to change an account's role

The dashboard has a new **Accounts** page (`/admin/accounts`) that lists every account (admins and customers). From
there an admin can promote a customer to admin, or change an admin back to a customer.

### Listing (probably no change needed)
`GET /admin/users` **without** a `role` query param must return **all** users, admins included. The `role`,
`accountStatus` and `search` filters and pagination keep working as now. Check this, and fix it if the handler
defaults to customers.

### New endpoint

```
POST /api/v1/admin/users/{id}/role
X-CSRF-Token: <token>
Content-Type: application/json

{ "role": "admin" }          // or "customer"
```

- **Auth:** admin session only. Same middleware as the other `/admin/users/{id}/*` actions (`/disable`, `/activate`,
  `/reset-password`): restricted sessions get `403 PASSWORD_CHANGE_REQUIRED`, customers get `403 FORBIDDEN`, and the
  CSRF check applies.
- **Body:** decoded strictly like every other body. Unknown fields → `422 VALIDATION_ERROR`.
- **Success:** `200` with `UserDetail` (the same shape as `GET /admin/users/{id}`: `UserView` + `websites`), showing
  the new role.

### Rules (in this order)

| # | Situation | Response |
|---|---|---|
| 1 | `role` missing or not `admin` / `customer` | `422 VALIDATION_ERROR`, `details: [{ field: "role", message: "must be one of: admin, customer" }]` |
| 2 | User id not found | `404 NOT_FOUND` |
| 3 | Target is the caller (`id` = session user) | `400 BAD_REQUEST`, message `you cannot change your own role` (same style as "you cannot disable yourself") |
| 4 | Target already has that role | `200` with the unchanged `UserDetail`. No writes, no audit entry, no session revocation |
| 5 | Demoting an admin would leave **zero non-disabled admins** | `409`, code **`LAST_ADMIN`**, message `at least one active admin must remain` |
| 6 | Otherwise | Apply the change (below) → `200` |

Rule 3 mostly covers rule 5, because the caller is an active admin who stays an admin. Keep rule 5 anyway: two
admins demoting each other at the same moment would otherwise leave no admin. Do the count check and the update **in
one transaction** (a Firestore transaction; a mutex or equivalent in the memory driver).

### Applying the change
1. Set `role` to the new value and bump `updatedAt`.
2. **Customer → admin:** admins can't own websites (the existing rule "ownerUserId must be a customer").
   Unassign every website the user owns: set `ownerUserId = ""` on each and set the user's `websiteIds = []`.
   Do this in the same transaction. Wedding sites keep working publicly; only dashboard ownership changes.
3. **Admin → customer:** `websiteIds` stays `[]`. Nothing else to do.
4. Keep `accountStatus`, `mustChangePassword`, temporary-password fields, lock state and `settings` as they are.
   The endpoint works for `active`, `disabled` and `pending_password_setup` accounts alike.
5. **Revoke all of the target user's sessions** (same as `POST /admin/users/{id}/revoke-sessions`). Their next
   sign-in then routes them by the new role.
6. Write one audit log entry:
   - `action`: **`admin.user.role_change`**
   - `targetType`: `user`, `targetId`: the user id
   - `metadata`: `{ "username": "<username>", "from": "customer", "to": "admin", "unassignedWebsiteIds": ["…"] }`
     (`unassignedWebsiteIds` is `[]` when nothing was unassigned)
7. The admin dashboard user counts (`admins`, `customers`) are computed from users, so they update by themselves.
   If they come from cached counters, update those too.

### Also update
- OpenAPI spec: add the path, request schema `{ role: Role }`, the `UserDetail` response, and errors 400/404/409/422.
- `API_ENDPOINTS.md`: document the endpoint and add `admin.user.role_change` to the audit action list.
- Error codes list: add `LAST_ADMIN` (409).

### Tests to add
- Promote a customer who owns 2 websites → `200`, `role: "admin"`, `websiteIds: []`, both websites have
  `ownerUserId: ""`, the user's sessions are revoked, and there is one `admin.user.role_change` audit entry listing
  both website ids.
- Demote admin B while admin A (the caller) stays → `200`, `role: "customer"`.
- Change your own role → `400`.
- `LAST_ADMIN`: over HTTP this only happens in a race, so test it at the service layer. Call the role-change
  function directly, with the target as the only non-disabled admin → `LAST_ADMIN` error, and nothing changed.
- Same role → `200`, no audit entry.
- `{ "role": "owner" }` → `422`. `{ "role": "admin", "extra": 1 }` → `422`.
- Customer session → `403 FORBIDDEN`. Missing CSRF → `403 CSRF_INVALID`.
- `GET /admin/users` without `role` returns admins and customers.

---

## Frontend reference (already done, for context)

- `src/services/admin.service.ts`: `changeRole(id, { role })` → `POST /admin/users/{id}/role`.
- `src/pages/admin/AccountsPage.tsx`: the page (search, role filter, status filter, row actions). It hides
  role, reset-password and disable actions on the caller's own row.
- `src/features/admin/useRoleChange.tsx`: the confirmation dialog. When promoting, it warns which websites become
  unassigned. It shows the backend's error message in a toast (e.g. `LAST_ADMIN`).
- `src/utils/password.ts`: the client-side policy mirror: length, blocklist, no surrounding spaces.
- `src/mocks/index.ts`: a mock implementation of both changes (`npm run dev:mock`), useful as a behavioural reference.
