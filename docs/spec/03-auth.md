# 03 · Auth (Phase 1)

One shared admin password protects everything under `/admin` and every admin
API route. Phase 1 is done when this works on a deployed preview and QA's auth
cases pass.

Owners: [Web backend](../teams/web-backend.md) (WEB-B-02, WEB-B-03), [Web frontend](../teams/web-frontend.md) (WEB-F-02), reviewed by [Cybersecurity](../teams/cybersecurity.md) (SEC-02).

---

## Requirements

| ID | Requirement |
|---|---|
| AUTH-1 | The password lives only in the `ADMIN_PASSWORD` environment variable. It is never in the repo, the client bundle, logs or error messages. |
| AUTH-2 | A correct password creates a session that lasts 12 hours. There is no "remember me". |
| AUTH-3 | A session survives page reloads and new tabs, and works across every admin page and admin API route. |
| AUTH-4 | Signed-out visitors to any `/admin/*` page are redirected to `/login`, and returned to the page they wanted after signing in. |
| AUTH-5 | Signed-in visitors to `/login` are sent straight to `/admin/certificates`. |
| AUTH-6 | Every admin API route answers `401 {"error":"Not signed in"}` without a valid session, independently of the page redirect. |
| AUTH-7 | A session cannot be forged, extended or reused after it expires. |
| AUTH-8 | Changing `ADMIN_PASSWORD` (or `SESSION_SECRET`) immediately invalidates every existing session. |
| AUTH-9 | Password guessing is slowed: 5 wrong attempts per IP per 15 minutes, then `429` with the minutes to wait. A correct password resets the counter. |
| AUTH-10 | Logging out clears the session cookie and returns to `/login`. |
| AUTH-11 | The login page is never indexed by search engines and cannot be framed by another site. |
| AUTH-12 | The `?next=` return path only accepts paths on this site (starting with a single `/`). Anything else falls back to `/admin/certificates`. |

---

## The session cookie

Stateless: the server stores nothing per session. The cookie proves itself.

| Property | Value |
|---|---|
| Name | `dbos_session` |
| Value | `<expiresAtMs>.<signature>` |
| Signature | HMAC-SHA256 over the string `<expiresAtMs>`, base64url, no padding |
| Signing key | The UTF-8 bytes of `SESSION_SECRET + ":" + ADMIN_PASSWORD` |
| Lifetime | `Max-Age=43200` (12 h), and the embedded expiry is checked on every request |
| Flags | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production |

Why each choice:

- **Expiry inside the signed value.** The browser's `Max-Age` is a hint; the server trusts only the signed expiry, so a cookie edited to live longer fails verification.
- **Password in the key.** Rotating the password invalidates every session without a session store (AUTH-8).
- **`HttpOnly`.** Page scripts, including any injected ones, cannot read the cookie.
- **`SameSite=Lax`.** The cookie is not sent on cross-site `POST`, `PATCH` or `fetch`, which blocks cross-site request forgery against the API. All admin APIs also require `Content-Type: application/json`, which a plain HTML form on another site cannot send.

### Verification steps (in this order)

1. Cookie present and a string, else **invalid**.
2. Splits on `.` into exactly an expiry and a signature, and the expiry is digits only, else **invalid**.
3. Expiry is in the future, else **invalid**.
4. `crypto.subtle.verify('HMAC', key, signature, expiry)` is true, else **invalid**. This comparison is constant-time.

Any exception during verification (bad base64, missing env) counts as
**invalid**, never as valid.

### Runtime

Use Web Crypto (`crypto.subtle`, `btoa`, `atob`, `TextEncoder`) only, not
Node's `crypto` module, so the same `lib/session.js` runs in `proxy.js` and in
route handlers without caring which runtime each uses.

---

## Password check

```js
// Hash both sides so the comparison is always over 32 bytes, whatever the
// candidate's length, then compare every byte without an early exit.
const [a, b] = await Promise.all([sha256(candidate), sha256(process.env.ADMIN_PASSWORD)])
let diff = 0
for (let i = 0; i < 32; i++) diff |= a[i] ^ b[i]
return diff === 0
```

- A missing `ADMIN_PASSWORD` means **every** login fails. It never means "no password".
- A non-string `password` in the body (missing, number, array) fails without throwing.

---

## Rate limiting

| Setting | Value |
|---|---|
| Key | `login:<client IP>` (first entry of `x-forwarded-for`, then `x-real-ip`, else `unknown`) |
| Window | Fixed, 15 minutes from the first attempt |
| Limit | 5 attempts; the 6th inside the window gets `429` |
| Reset | A successful login deletes the key |
| Response | `429 {"error":"Too many attempts. Try again in N min."}` with a `Retry-After` header in seconds |

**Known limit:** the counter lives in the function's memory, so it resets on a
cold start and is not shared across Vercel instances. It slows guessing; it
does not stop a determined attacker on its own. A strong password is the real
defence (at least 16 random characters, see [08 Security](08-security.md#sec-01-password-policy)).
If the app ever needs more, move the counter into MongoDB with a TTL index.

---

## Endpoints

### `POST /api/auth/login`

Request:

```json
{ "password": "…" }
```

| Case | Status | Body | Side effect |
|---|---|---|---|
| Correct password | 200 | `{ "ok": true }` | Sets `dbos_session`; resets the rate-limit key |
| Wrong, missing or non-string password | 401 | `{ "error": "Wrong password" }` | Counts toward the limit |
| Over the limit | 429 | `{ "error": "Too many attempts. Try again in 12 min." }` | `Retry-After` header |
| Malformed JSON body | 401 | `{ "error": "Wrong password" }` | Counts toward the limit |

The response never says whether the password was *close*, and is the same for
a missing and a wrong password.

### `POST /api/auth/logout`

Always `200 { "ok": true }` and deletes the cookie (`Max-Age=0`). Works with or
without a session.

---

## Page gate (`proxy.js`)

Next.js 16 renamed `middleware.js` to `proxy.js`, with an exported `proxy`
function.

```js
export const config = { matcher: ['/admin/:path*', '/login'] }
```

| Request | Session | Result |
|---|---|---|
| `/admin/...` | invalid | `307` → `/login?next=<original path and query>` |
| `/admin/...` | valid | continue |
| `/login` | valid | `307` → `/admin/certificates` |
| `/login` | invalid | continue |

API routes are **not** matched here on purpose. A `fetch()` caller needs a
`401` it can handle, not an HTML redirect. Each admin route calls:

```js
const denied = await requireAdmin()   // lib/auth.js
if (denied) return denied             // 401 {"error":"Not signed in"}
```

The admin layout (`app/admin/layout.jsx`) also checks the session on the
server and redirects. That is the third layer, and it costs nothing.

---

## Login page (`/login`)

| Element | Detail |
|---|---|
| Content | dBug Labs logo, eyebrow "dBug Labs OS", heading "Admin sign in", one line of help text, a password field, a *Sign in* button |
| Field | `type="password"`, `autocomplete="current-password"`, focused on load, required |
| Button | Disabled while the field is empty or a request is in flight; label changes to *Checking…* |
| Error | Shown under the field, read out by screen readers (`role="alert"`). Text comes from the API. |
| Success | Full navigation (not client-side routing) to the `next` path, so the proxy sees the new cookie |
| `useSearchParams` | The form reads `?next=`, so it must sit inside `<Suspense>` or the build fails on a static page |

Design: [Creatives CRE-01](../teams/creatives.md). Copy: [PR PR-02](../teams/pr.md).

---

## Admin shell

Every `/admin` page has a sticky top bar: the logo and "dBug Labs OS" on the
left; *Generator*, *Certificate log* and *Log out* on the right. The active
link is highlighted. *Log out* calls the logout endpoint, then
`router.replace('/login')` and `router.refresh()` so no cached admin page
remains.

If any admin API call returns `401` while the admin is working (the session
expired mid-task), the page shows "Your session expired. Sign in again." and,
on the log page, sends the admin to `/login?next=<current page>`. The generator
must **not** navigate away mid-run, because the admin would lose the rendered
certificates in memory; it shows the message and the admin signs in in a new
tab, then uses *Resend*.

---

## Environment

| Variable | Rule |
|---|---|
| `ADMIN_PASSWORD` | Required. At least 16 characters, random. Shared only through the club's password manager or in person, never in a group chat. |
| `SESSION_SECRET` | Required. At least 32 characters. The app refuses to sign or verify with a shorter one. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |

Both are set separately for Production and Preview in Vercel, and they are
different values, so a preview login does not work on production.

---

## Acceptance (Phase 1 exit)

QA runs cases AUTH-T01 to AUTH-T16 in [09 Testing](09-testing.md#auth). Phase 1
is done when all of them pass on a deployed preview and Cybersecurity has
signed off SEC-02.
