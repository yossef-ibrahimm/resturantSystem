# Full Codebase Audit Report — Tasty Table Studio

| | |
|---|---|
| **Date** | 2026-09-24 |
| **Project root** | `C:\Users\Yossef\Desktop\tying\tasty-table-studio` |
| **Mode** | Read-only audit (only this report file was created) |
| **Stack** | React 18 + Vite 5 + TypeScript (root `src/`), NestJS 10 + Prisma 5 + PostgreSQL (`apps/api`), Socket.IO, MinIO/local uploads |
| **Roles** | admin, cashier, waiter, kitchen_staff + public customer flows |

---

## 1. Executive Summary

Tasty Table Studio is a bilingual (AR/EN) restaurant POS: kitchen/waiter/cashier/admin roles, cash shifts, inventory, expenses, reports, JWT HttpOnly-cookie auth, and WebSocket order updates. Architecture is coherent (global guards, ValidationPipe whitelist, Decimal money, idempotency keys, audit logs). Prior work in `AUDIT_REPORT.md` (2026-09-05) already fixed several money bugs (e.g. `paymentStatus` ternary).

This full re-audit finds the system **functionally capable but not clean-ship ready**:

| Severity | Count |
|---|---:|
| **CRITICAL** | 3 |
| **HIGH** | 8 |
| **MEDIUM** | 27 |
| **LOW** | 16 |
| **INFO** | 4 |
| **Total** | **58** |

**Headline risks**

1. **DB-001 (CRITICAL):** No migration ever creates `Payment`. `20260903100000_critical_fixes_bundle` ALTERs/CREATE INDEX on `Payment`/`cashShiftId`. `prisma migrate dev` fails **P3006/P1014**. Live DB only works because the table was created out-of-band (`apps/api/dump.sql`).
2. **DB-002 (CRITICAL):** Prisma `RestaurantSettings` fields (`totalTables`, `tableNumberStart`, `tableNumberEnd`, `staleThresholdMinutes`, `cashShiftVarianceThreshold`) have **no migration**; tables/settings features break on a clean database.
3. **DB-003 (CRITICAL):** Seed credentials are committed in source (`Admin123`, `password123`, etc.).
4. **Money UI:** Admin Order History “Total” ignores tax/service/discount (`FE-201`); Sales report collapsed row uses `itemsTotal` not `order.total` (`FE-202`); partial payments render as Unpaid (`FE-004`, `FE-203`).
5. **Auth UX:** Navbar reads non-existent `state.token` → dashboard button never shows (`FE-001`).
6. **Quality gates:** Frontend `tsc` fails; API `tsc` clean; ESLint **114 errors / 10 warnings**; API Jest **4 suites / 5 tests failed**; frontend Vitest **1/1 passed** (example only). `build` is `vite build` with **no typecheck**.

**Checks executed (read-only)**

| Check | Result |
|---|---|
| Root `npx tsc --noEmit -p tsconfig.app.json` | **FAIL** (many errors) |
| `npm run lint` (eslint) | **FAIL** — 124 problems (114 errors, 10 warnings) |
| `npm test` (vitest) | **PASS** — 1/1 |
| `apps/api: npx tsc --noEmit -p tsconfig.json` | **PASS** — exit 0 |
| `apps/api: npm test` (jest) | **FAIL** — Test Suites: 4 failed, 10 passed; Tests: 5 failed, 129 passed |
| `git check-ignore .env apps/api/.env` | **PASS** — both ignored |
| Migration inventory vs `schema.prisma` | **FAIL** — Payment + settings columns missing |
| Secrets in deploy/Docker | **PASS** — no secrets in `deploy.yml` / Dockerfiles |

**Report path:** `FULL_CODEBASE_AUDIT_REPORT.md` (project root).

---

## 2. Scope & Methodology

**In scope**

- Full tree inventory (112 `.ts`, 78 `.tsx`, 15 Prisma migrations, 19 `.sql`, CI/Docker).
- Backend modules: auth, users, orders, payments, cash-shifts, reports, dashboard, inventory, stock, expense, settings, menu, tables, attendance, notifications, storage, websocket, common guards/filters.
- Frontend: `App.tsx`, `lib/api.ts`, `lib/types.ts`, auth store, ProtectedRoute, Navbar, OrderHistory, CashierOrderBuilder, SalesReportPage, reports/cashier/waiter/admin surfaces (partial + subagent).
- DB: `schema.prisma`, all migrations, `dump.sql` evidence, seed scripts.
- Config: root/`apps/api` `package.json`, `vite.config.ts`, `eslint.config.js`, `.github/workflows/deploy.yml`, Docker, env ignore rules.
- Executed checks above; three parallel read-only subagent passes (FE core, FE reports, DB/config).

**Method**

- Line-level reads of money, auth, and status-transition paths.
- Grep for `@Public`/`@Roles`, timezone math, `paymentStatus`, dead service methods, secrets.
- Severity = business/security/ship impact; confidence = Confirmed (code + check) / Probable / Needs Verification.
- IDs: `BE-`, `FE-`, `DB-`, `CFG-`, `PERF-` — unique, no duplicates.
- Not fixed: no source, DB, or config changes. Only this file.

**Out of scope / not run**

- Live penetration testing, load testing, production deploy.
- Full UI E2E (Playwright/Cypress absent).
- Repairing broken `prisma migrate` shadow path (documented only).

---

## 3. Environment & Runtime State

| Item | Observed |
|---|---|
| Platform | Windows win32, PowerShell; date 2026-09-24 |
| Frontend | Vite `:5173` (PID ~20920), proxy `/api` + `/socket.io` → `:3001` |
| API | Nest `--watch` `:3001` (PID ~21964), log `%TEMP%\api.log` |
| Port 8080 | Held by IIS SmartX (PID 4); needs admin — blocked |
| Postgres | `:5432`, DB `tastytable` |
| Docker | Not available |
| MinIO | Not running (`:9000`); local upload fallback |
| Auth cookie | `tastytable_token` HttpOnly; login expects `{email,password}` |
| Seeds | Known weak passwords committed; not re-run this session |

Earlier session fixes (already applied before this audit): API `.env` port 5433→5432; Vite `strictPort:false` + proxy; duplicate import removed in `api.ts`; `prisma generate` + `migrate deploy` of 15 recorded migrations (Payment/settings still broken — see DB-001/DB-002).

---

## 4. Architecture Overview

```
Browser (React/Zustand/React Query)
  │  HttpOnly cookie + fetch credentials:include
  ├─ Vite proxy /api, /socket.io → :3001
  ▼
NestJS (global prefix /api)
  APP_GUARD: JwtAuthGuard → StaffAwareThrottlerGuard
  Controllers + RolesGuard/@Roles
  Services (Decimal money, $transaction, idempotency)
  Prisma → PostgreSQL
  WebSocket gateway (order broadcasts)
  Storage: MinIO or local uploads
```

- **Auth:** JWT in HttpOnly cookie; `JwtStrategy.validate` loads user from DB (role not trusted from token alone for active check).
- **Public surface:** menu/categories read, order create/by-token, bill request by token, settings read, login/register-related `@Public` routes as marked.
- **Money:** server snapshots `itemsTotal/tax/service/total/paidTotal` on `Order`; payments mutate `paidTotal` + `paymentStatus` in one transaction.
- **Frontend auth state:** only `user` + `hasHydrated` in `authStore` — **no `token` field** (root of FE-001).

---

## 5. Security Findings

| Area | Assessment | Refs |
|---|---|---|
| Password hashing | bcrypt cost 10 — OK | — |
| Cookie flags | HttpOnly; `secure`/`sameSite` tied to production — OK with TLS | — |
| JWT secret | Production refuses default secret in `main.ts` — OK | — |
| Helmet, ValidationPipe whitelist/forbid, trust proxy | Present — OK | — |
| Login throttle | `@Throttle` on login — OK for anonymous | — |
| Staff rate-limit bypass | **All staff roles skip throttling** — DoS/abuse by any logged-in account | BE-001 |
| Seed passwords in repo | **CRITICAL** — admin/cashier/waiter/kitchen | DB-003 |
| DB dumps with hashes | `apps/api/dump.sql`, `dump2.sql` present locally | DB-004, CFG-005 |
| CORS default origin | `http://localhost:8080` vs Vite `5173` — broken/dev mismatch; production must set `FRONTEND_URL` | CFG-001 |
| Order enumeration | Opaque `orderToken` path exists; by-number helpers not routed | BE-021 |
| Refunds | Admin-only + reason + `refundedPaymentId`; `approvedById` defaults to actor (self-approval) | BE-010 |
| MinIO defaults | `minioadmin`/`minioadmin`, public-read bucket policy | CFG-003 |
| RolesGuard errors | Can leak role names / required roles in messages | BE-008 |
| WS auth | Gateway broadcast is app-level; no per-room isolation model | BE-024 |
| .env gitignore | Confirmed ignored | — |
| CI secrets | `deploy.yml` clean; build env via vars | — |

**No evidence of committed JWT secrets or API keys** in tracked config beyond seed passwords and local SQL dumps.

---

## 6. Database & Schema Findings

### 6.1 Migration graph

15 migrations under `apps/api/prisma/migrations/`. Critical gaps:

1. **`Payment` never created by any migration.**  
   `critical_fixes_bundle/migration.sql:44-63` does `ALTER TABLE "Payment" …`, FKs, `CREATE INDEX … ON "Payment"("refundedPaymentId"|"cashShiftId")`.  
   Evidence table exists only out-of-band: `apps/api/dump.sql` (`CREATE TABLE "Payment"`).  
   Observed failure: `prisma migrate dev` → **P3006 / P1014** — *Migration failed to apply cleanly to the shadow database… The underlying table for model `Payment` does not exist.*

2. **`RestaurantSettings` table-management columns not migrated.**  
   `schema.prisma:305-312` declares `cashShiftVarianceThreshold`, `totalTables`, `tableNumberStart`, `tableNumberEnd`, `staleThresholdMinutes`. No migration adds them. Runtime services (`tables.service`, `settings.service`) `select` those columns → fail on clean DB.

3. **`CashShift`** is created in the same critical bundle with `IF NOT EXISTS` — better — but `Payment` half of the bundle is not fully idempotent on a DB that never got `Payment`.

### 6.2 Other DB items

- Money columns: `Decimal` — good.
- No partial unique index “at most one open CashShift” → double-open race (DB-005).
- Loose root SQL: `add_data.sql`, `temp_add.sql`, `query` — hygiene (DB-006).
- Seeds write weak passwords (DB-003).

---

## 7. Backend (NestJS) Findings

### 7.1 Security / auth / throttling

| ID | Sev | Location | Issue |
|---|---|---|---|
| BE-001 | HIGH | `staff-throttler.guard.ts:19-28` | If `request.user.role` ∈ staff set, **return true without super.canActivate** — zero rate limit for authenticated staff on all throttled routes. |
| BE-008 | MEDIUM | `roles.guard.ts` (error path) | Failure messages can include caller role + required role list → information disclosure. |
| BE-010 | MEDIUM | `payments.service.ts:175` | `approvedById: amount < 0 ? (approvedById \|\| actorId \|\| null)` — refund self-approval when actor is admin. |
| BE-024 | INFO | `websocket.gateway.ts` | No room/tenant partition; any connected client receives global order broadcasts (acceptable for single-tenant POS, document it). |

### 7.2 Orders / payments / cash

| ID | Sev | Location | Issue |
|---|---|---|---|
| BE-005 | MEDIUM | `orders.service.ts:500-538` | `applyDiscount` recomputes `total = itemsTotal - discount + tax + service` with **tax/service left on pre-discount base**. Valid “discount-after-tax” only if product policy says so; otherwise over-collects tax. Not documented in API/UI. |
| BE-006 | MEDIUM | `orders.service.ts:426-437` | Comment: “allowed until ready”; guard blocks only `completed`/`cancelled`; error text says “Only received or preparing”. **Ready can be cancelled** — comment/error/logic disagree. |
| BE-007 | MEDIUM | `payments.controller.ts:80` | `GET` payments roles include **`kitchen_staff`** — over-broad for financial data. |
| BE-009 | MEDIUM | `payments.service.ts:101` vs `:120` | Refund remaining uses `.lt(0)`; `paidTotal` floor uses `< -0.01` — inconsistent epsilons. |
| BE-011 | MEDIUM | `cash-shifts.service` open path | No DB-level unique “one open shift”; race can create two opens (pairs with DB-005). |
| BE-012 | LOW | cash close math | TODO: non-cash refunds / card refunds not fully folded into expected cash. |
| BE-013 | LOW | settings | `cashShiftVarianceThreshold` stored but **never enforced** on close. |
| BE-021 | LOW | `orders.service.ts:85,288` | `findByNumber`, `requestBillByNumber` — **no controller routes** (dead API surface; token path is live). |
| BE-023 | MEDIUM | `payments.service.ts:143-153` | Server writes `partially_paid` (Phase 0 correct) — consumers must handle third state (cross-ref FE-004). |

**Positive:** payment create uses optimistic `updateMany` on `paidTotal` + ConflictException; idempotency keys; Decimal arithmetic; admin-only refund path separate from POST payment.

### 7.3 Reports / dashboard / timezones

| ID | Sev | Location | Issue |
|---|---|---|---|
| BE-002 | HIGH | `reports.service.ts:196-199` | Weekly buckets: `toZonedTime` then `weekStart.setDate(zoned.getDate() - zoned.getDay())` then `formatInTimeZone(weekStart, CAIRO_TZ)` — **`getDay`/`setDate` run in server TZ semantics on a shifted Date** → wrong week labels (known class of bug; residual risk Confirmed by code shape). |
| BE-003 | MEDIUM | `dashboard.service.ts:12` | `startOfDay = new Date(y,m,d)` uses **server local TZ**, not `Africa/Cairo`. |
| BE-004 | MEDIUM | `expenses.service.ts:29,260`; `inventory.service.ts:194` | `setHours(23,59,59,999)` server TZ — day boundaries wrong if host ≠ Cairo. |
| — | — | `attendance.service.ts` | Uses `CAIRO_TZ` constant — good contrast. |

### 7.4 Inventory / stock / expenses / menu / settings

| ID | Sev | Location | Issue |
|---|---|---|---|
| BE-014 | MEDIUM | `stock.service.ts:355+` | `consumeForSale` only referenced from **tests**; production `orders.service` does not call it on preparing (tests expect it — suite red). Dead-but-tested API vs intentional Phase deferral. |
| BE-015 | LOW | `stock.service.ts` deduct path | Comment claims “allows negative” but code throws — misleading. |
| BE-016 | LOW | `inventory.service.ts` dashboard | `$queryRawUnsafe` with fixed string — fragile pattern (no user concat observed). |
| BE-017 | MEDIUM | `expenses.service.ts` | Audit insert **outside** expense transaction; **update** path lacks audit. |
| BE-018 | MEDIUM | `menu.service.ts` update | TOCTOU: read/validate then write without row version guard. |
| BE-019 | MEDIUM | `orders.service` mergeOrders | MergedGroup create + `updateMany` not one hard consistency story for partial failure. |
| BE-020 | LOW | `notifications.service.ts` | `markAllAsRead` without user filter scope risk if multi-user. |
| BE-025 | MEDIUM | `settings.service` DEFAULT_SETTINGS | Default object may omit `cashShiftVarianceThreshold` vs schema default 50 — GET without row returns incomplete shape vs FE types (Needs Verification). |

### 7.5 Storage / upload

| ID | Sev | Location | Issue |
|---|---|---|---|
| BE-022 | MEDIUM | `storage.controller.ts:17-21` | `fileFilter`: on non-image, `cb(err,false)` **without return**, then **also** `cb(null,true)` — double callback; multer may accept rejected files or throw. |
| — | LOW | `storage.service.ts:39-40` | Default MinIO keys `minioadmin` (see CFG-003). Public bucket policy intentional for menu images. |

### 7.6 HTTP / bootstrap

| ID | Sev | Location | Issue |
|---|---|---|---|
| CFG-001 | HIGH | `main.ts:38` | Default `FRONTEND_URL=http://localhost:8080` — conflicts with Vite `5173` unless env set (credential CORS failures in default dev). |
| — | INFO | `main.ts` | Production JWT guard, helmet, prefix, static uploads — sound. |
| BE-026 | LOW | `http-exception.filter.ts` | Non-Error throwables → generic 500; limited stack logging. |

---

## 8. Frontend (React) Findings

### 8.1 Confirmed functional bugs

| ID | Sev | Location | Issue |
|---|---|---|---|
| FE-001 | HIGH | `Navbar.tsx:32,43`; `authStore.ts:24-30` | `const token = useAuthStore((s) => s.token)` — **`token` not on `AuthState`**. `showDashboardButton` requires `token && !isTokenExpired(token)` → **always falsy**. TS2339 also reported by `tsc`. |
| FE-002 | MEDIUM | `CashierOrderBuilder.tsx:79` | `toast.error(err?.message \|\| language === "ar" ? "فشل…" : "Failed…")` — **operator precedence**: condition is `(err?.message \|\| language==="ar")`, not “message or fallback”. Wrong toast when message exists or language is ar. |
| FE-003 | MEDIUM | `lib/types.ts` `Order` | Missing `mergedGroupId` (and related merge fields) used by merge UI/types elsewhere — type/compile friction (TS errors in related components). |
| FE-004 | HIGH | `types.ts:43` vs `payments.service.ts:149` | FE `PaymentStatus = "unpaid" \| "paid" \| "refunded"` — **no `partially_paid`**. Server writes it. Exhaustive switches/badges collapse partial → Unpaid. |
| FE-201 | HIGH | `OrderHistory.tsx:259,300` | List and dialog **Total = Σ(items)** only — omits `taxAmount`, `serviceAmount`, `discountAmount`; ignores server `order.total`. **Wrong money on admin order history.** |
| FE-202 | MEDIUM | `SalesReportPage.tsx:671,712-715` | Collapsed row shows `itemsTotal`; strikethrough `itemsTotal + discountAmount` — wrong vs `order.total` / real list price; expanded “Total” uses `order.total` (inconsistent). |
| FE-203 | MEDIUM | `SalesReportPage.tsx:776-782` | Payment badge: only paid/refunded/unpaid — **`partially_paid` → “Unpaid”**. |
| FE-204 | LOW | `OrderHistory.tsx:304` | Cancel affordance only `received\|preparing` while API allows cancel of `ready` (BE-006) — UI stricter than API. |

### 8.2 Types, tests, hygiene (frontend)

| ID | Sev | Evidence | Issue |
|---|---|---|---|
| CFG-002 | HIGH | `tsc -p tsconfig.app.json` FAIL | Numerous errors: `Navbar` token; `OrderHistory`/`SalesReportPage` `formatPrice` locale typing; unused `Lang`/`CashierPaymentDialogProps.mergedGroup`; etc. **`npm run build` = `vite build` only — no type gate.** |
| CFG-008 | LOW | eslint | `@typescript-eslint/no-unused-vars` **off**; heavy `no-explicit-any` in `api.ts` and elsewhere → 114 errors. |
| CFG-010 | LOW | tests | Only `example.test.ts`-class coverage; no cashier/payment/reports unit tests. |
| CFG-006 | MEDIUM | scripts | i18n parity check known broken / not enforcing AR/EN key parity. |
| — | — | `ProtectedRoute.tsx` | Role landing + `mustChangePassword` redirect — good. |
| — | — | `api.ts` | 30s AbortController timeout, 401 handler — good patterns. |

### 8.3 Cross-layer money/status matrix

| Concern | Server | Client | Match? |
|---|---|---|---|
| `paymentStatus` third state | `partially_paid` | union omits it | **No (FE-004)** |
| Order total display | `order.total` snapshot | OrderHistory/Sales collapsed use item sum | **No (FE-201/202)** |
| Dashboard nav | cookie JWT | Navbar requires store `token` | **No (FE-001)** |
| Settings table fields | schema + services | FE types include `totalTables` etc. | API OK if DB migrated; **DB-002 blocks clean deploys** |
| Discount policy | pre-discount tax retained | UI rarely explains | Policy unclear (BE-005) |

---

## 9. Performance Findings

| ID | Sev | Location | Issue |
|---|---|---|---|
| PERF-001 | HIGH | `reports.service.ts:87-96` | `getSummary` **findMany all orders** in current + previous range with full include — no SQL aggregate; large ranges → memory/CPU spike. |
| PERF-002 | MEDIUM | `dashboard.service.ts:37` | Loads order set then **filters `paymentStatus==="paid"` in JS** for revenue — should aggregate in SQL. |
| PERF-003 | LOW | multiple `findMany` | Missing pagination/`take` on staff list endpoints (orders cursor exists; some reports unbounded). |
| PERF-004 | LOW | WS + React Query | Global order broadcasts re-render broad lists without query key granularity (Needs Verification under load). |

---

## 10. Configuration, CI/CD & Deployment Findings

| ID | Sev | Item | Finding |
|---|---|---|---|
| CFG-001 | HIGH | CORS / dev ports | Default origin 8080 vs Vite 5173 (see §7.6). |
| CFG-002 | HIGH | Build pipeline | No `tsc` before `vite build`; type errors ship. |
| CFG-003 | MEDIUM | MinIO | Default `minioadmin` credentials + public read policy. |
| CFG-004 | INFO | env | `.env` and `apps/api/.env` **gitignored** (confirmed). |
| CFG-005 | MEDIUM | Local dumps | `apps/api/dump.sql`, `dump2.sql` contain schema **and password hashes** — risk if ever committed/published. |
| CFG-006 | MEDIUM | i18n tooling | Parity script not enforcing key equality (broken/unused). |
| CFG-007 | INFO | GitHub Actions | `deploy.yml`: `npm ci` + `npm run build`; secrets only via `vars`; permissions minimal — **clean**. |
| CFG-009 | MEDIUM | API tests | Jest **4 failed suites, 5 failed tests** (see §11). |
| CFG-010 | LOW | FE tests | Effectively no product tests. |
| CFG-011 | LOW | Docker | Dockerfiles have no obvious secrets; MinIO compose defaults weak (CFG-003). |
| CFG-012 | LOW | Dual lockfiles | `bun.lock` + `bun.lockb` + `package-lock.json` — tool confusion. |
| CFG-013 | LOW | Root package name | Still `vite_react_shadcn_ts` — scaffold leftover. |
| CFG-014 | INFO | Port 8080 | External IIS occupies 8080; app moved to 5173 — document for operators. |

---

## 11. Testing & Code Quality

### 11.1 Commands run

| Command | Outcome |
|---|---|
| Root `npx tsc --noEmit -p tsconfig.app.json` | **FAIL** |
| Root `npm run lint` | **FAIL** — 124 problems (114 errors, 10 warnings) |
| Root `npm test` | **PASS** — 1/1 (vitest) |
| `apps/api` `npx tsc --noEmit` | **PASS** |
| `apps/api` `npm test` | **FAIL** — 4/14 suites failed; 5/134 tests failed |

### 11.2 API Jest failures (Confirmed)

| Suite | Failure gist |
|---|---|
| `settings.service.spec.ts` | NaN expectations (`serviceRate`, `staleThresholdMinutes`, `tableNumberStart/End`, `taxRate`, `totalTables`) — mocks/schema drift. |
| `auth.service.spec.ts` | `changePassword` test password lacks **uppercase** — policy vs fixture mismatch. |
| `orders.service.spec.ts` | Expects `stockService.consumeForSale` on preparing — **implementation does not call it** (BE-014). |
| `stock.service.spec.ts` | DecimalError / type coercion in stock specs. |

### 11.3 Quality gaps

- ESLint: unused-vars disabled; `any` widespread in `api.ts`.
- Frontend: no coverage of money display, payment status machine, Navbar auth.
- No e2e for cashier → kitchen → pay → report.
- Pre-existing lint debt (~114 errors) known from earlier session; not introduced by this audit.

---

## 12. Cross-Layer / Integration Findings

| ID | Severity | Story |
|---|---|---|
| FE-001 + authStore | HIGH | Cookie JWT works; UI gate needs non-existent store token → staff never see dashboard entry. |
| BE-023 + FE-004 + FE-203 | HIGH | Partial payment status produced server-side, dropped client-side. |
| FE-201/202 + orders money snapshot | HIGH | Server computes authoritative `total`; admin/report UIs recompute item sums. |
| DB-002 + settings/tables FE | CRITICAL on clean DB | UI and services select migrated-absent columns. |
| DB-001 + payments | CRITICAL | Payment module depends on table no migration creates. |
| CFG-001 + vite proxy | HIGH | Two different default origins; easy “works on my machine” CORS break. |
| BE-006 + FE-204 | MEDIUM | Cancel rules: API vs admin UI disagree on `ready`. |
| BE-014 + Jest | MEDIUM | Spec encodes stock-deduct feature that service intentionally/accidentally omitted. |

**Workflow trace (paid order):** create (public throttle) → kitchen status → optional bill token → cashier payment (shift required for cash) → `paymentStatus`/`paidTotal` update → reports filter `paymentStatus==="paid"` → OrderHistory/Sales UI may still show item subtotal only. **Breaks at display and third status.**

---

## 13. Dead Code & Maintainability

| ID | Item | Notes |
|---|---|---|
| BE-021 | `findByNumber`, `requestBillByNumber` | No HTTP routes; tests only. |
| BE-014 | `consumeForSale` | Production-dead; tests green-path depends on it. |
| BE-013 | `cashShiftVarianceThreshold` | Persisted, unused in close logic. |
| CFG-012/013 | Dual locks / scaffold package name | Hygiene. |
| DB-006 | Root `add_data.sql`, `temp_add.sql`, `query` | Ad-hoc SQL debris. |
| AUDIT_REPORT.md | Prior audit | Useful history; this report supersedes for 2026-09-24 snapshot; several prior CRITICAL payment ternary items marked fixed in code — residual FE display issues remain. |

---

## 14. Full Issue Register

Severity: CRITICAL > HIGH > MEDIUM > LOW > INFO. Confidence: Confirmed / Probable / Needs Verification.

| ID | Sev | Area | Confidence | Summary |
|---|---|---|---|---|
| DB-001 | CRITICAL | DB | Confirmed | No migration creates `Payment`; critical bundle ALTERs/INDEXes it; P3006/P1014 on clean shadow; table only via `dump.sql`. |
| DB-002 | CRITICAL | DB | Confirmed | `RestaurantSettings` management columns + variance threshold in schema, **no migration**. |
| DB-003 | CRITICAL | Security/DB | Confirmed | Seed passwords in `seed-all.ts` / `seed-users.ts` (`Admin123`, `password123`, …). |
| CFG-001 | HIGH | Config | Confirmed | CORS default `localhost:8080` vs Vite `5173`. |
| CFG-002 | HIGH | Build | Confirmed | Frontend `tsc` fails; `vite build` does not typecheck. |
| BE-001 | HIGH | Security | Confirmed | Staff roles bypass all throttling. |
| BE-002 | HIGH | Reports | Confirmed | Weekly TZ bucket arithmetic risk / wrong week labels. |
| FE-001 | HIGH | FE | Confirmed | Navbar `s.token` missing → dashboard button dead. |
| FE-004 | HIGH | FE/types | Confirmed | `PaymentStatus` lacks `partially_paid`. |
| FE-201 | HIGH | FE/money | Confirmed | OrderHistory total ignores tax/service/discount. |
| PERF-001 | HIGH | Perf | Confirmed | Report summary loads full order sets into memory. |
| BE-003 | MEDIUM | Dashboard | Confirmed | `startOfDay` server TZ not Cairo. |
| BE-004 | MEDIUM | Reports/expenses | Confirmed | `setHours` day-end server TZ. |
| BE-005 | MEDIUM | Money | Confirmed | Discount does not rebase tax/service; policy undocumented. |
| BE-006 | MEDIUM | Orders | Confirmed | Cancel allows `ready`; comment/error disagree. |
| BE-007 | MEDIUM | Security | Confirmed | Kitchen can `GET` payments list. |
| BE-008 | MEDIUM | Security | Probable | RolesGuard error may leak role requirements. |
| BE-009 | MEDIUM | Money | Confirmed | Inconsistent refund epsilons (`0` vs `0.01`). |
| BE-010 | MEDIUM | Audit | Confirmed | Refund `approvedById` defaults to actor (self-approve). |
| BE-011 | MEDIUM | Cash shift | Confirmed | No DB unique open-shift constraint → race. |
| BE-014 | MEDIUM | Inventory | Confirmed | `consumeForSale` not wired in orders; tests fail. |
| BE-017 | MEDIUM | Expenses | Confirmed | Audit outside tx; update unaudited. |
| BE-018 | MEDIUM | Menu | Probable | Update TOCTOU. |
| BE-019 | MEDIUM | Orders | Probable | Merge not fully atomic across entities. |
| BE-022 | MEDIUM | Upload | Confirmed | `fileFilter` double-`cb` missing `return`. |
| BE-023 | MEDIUM | Payments | Confirmed | Server emits `partially_paid` (consumer bug FE-004). |
| BE-025 | MEDIUM | Settings | Needs Verification | Default settings object may omit variance threshold. |
| CFG-003 | MEDIUM | Config | Confirmed | MinIO default credentials + public bucket. |
| CFG-005 | MEDIUM | Secrets | Confirmed | Local SQL dumps hold password hashes. |
| CFG-006 | MEDIUM | i18n | Probable | Parity check not enforcing. |
| CFG-009 | MEDIUM | Tests | Confirmed | 4 API suites / 5 tests failing. |
| DB-004 | MEDIUM | Secrets | Confirmed | `dump.sql`/`dump2.sql` present under `apps/api`. |
| DB-005 | MEDIUM | DB | Confirmed | No partial unique index for single open CashShift. |
| FE-002 | MEDIUM | FE | Confirmed | Toast operator-precedence bug. |
| FE-003 | MEDIUM | FE | Confirmed | `Order` missing `mergedGroupId`. |
| FE-202 | MEDIUM | FE/money | Confirmed | Sales collapsed row wrong price/strikethrough. |
| FE-203 | MEDIUM | FE | Confirmed | Partial paid shown as Unpaid in sales badge. |
| PERF-002 | MEDIUM | Perf | Confirmed | Dashboard revenue filtered in JS. |
| BE-012 | LOW | Cash | Confirmed | Close cash math incomplete (TODO in code). |
| BE-013 | LOW | Settings | Confirmed | Variance threshold unused. |
| BE-015 | LOW | Inventory | Confirmed | Stale comment on negative stock. |
| BE-016 | LOW | Inventory | Confirmed | `$queryRawUnsafe` pattern. |
| BE-020 | LOW | Notifications | Probable | `markAllAsRead` scope. |
| BE-021 | LOW | Dead code | Confirmed | Unrouted by-number helpers. |
| BE-026 | LOW | HTTP | Probable | Generic 500 logging for non-Error. |
| CFG-008 | LOW | Lint | Confirmed | unused-vars off; `any` heavy. |
| CFG-010 | LOW | Tests | Confirmed | No meaningful FE tests. |
| CFG-011 | LOW | Docker | Probable | Compose default creds. |
| CFG-012 | LOW | Repo | Confirmed | Dual lockfiles. |
| CFG-013 | LOW | Repo | Confirmed | Scaffold package name. |
| DB-006 | LOW | Hygiene | Confirmed | Loose SQL files at root. |
| FE-204 | LOW | FE | Confirmed | UI cancel stricter than API on `ready`. |
| PERF-003 | LOW | Perf | Probable | Unbounded list queries. |
| PERF-004 | LOW | Perf/FE | Needs Verification | Global order broadcasts may re-render broad lists without query-key granularity. |
| BE-024 | INFO | WS | Confirmed | No WS room isolation (single-tenant OK). |
| CFG-004 | INFO | Config | Confirmed | `.env` ignored — positive. |
| CFG-007 | INFO | CI | Confirmed | Deploy workflow clean. |
| CFG-014 | INFO | Ops | Confirmed | Port 8080 held by IIS. |

**Severity tally (must match Executive Summary):** CRITICAL 3 · HIGH 8 · MEDIUM 27 · LOW 16 · INFO 4 · **Total 58**.

---

## 15. Remediation Plan

Ordered for safety; **no fixes applied in this audit.**

### P0 — Stop the bleeding (before any clean install/prod)

1. **DB-001:** Add a real baseline migration that `CREATE TABLE IF NOT EXISTS "Payment"` (+ FKs/indexes), repair `critical_fixes_bundle` so a **clean** `migrate deploy` succeeds; verify against empty DB (not only live `tastytable`).
2. **DB-002:** Migration for all missing `RestaurantSettings` columns with schema defaults; `migrate diff` clean.
3. **DB-003 / CFG-005 / DB-004:** Rotate all seed passwords; force `mustChangePassword`; remove plaintext passwords from seeds (env/first-run generator); purge or gitignore-exclude dumps from any publish path; never commit `dump*.sql`.
4. **CFG-001:** Default CORS to include `http://localhost:5173` (or require explicit `FRONTEND_URL`); document prod allowlist.
5. **CFG-002:** Add `tsc --noEmit` (or `vue-tsc`-equivalent gate) to `build` / CI; fix **FE-001**, **FE-201**, **FE-004** first (auth + money + status union).

### P1 — Money & payments correctness

6. **FE-201 / FE-202:** Display `order.total` (and tax/service/discount breakdown) everywhere; delete client item-sum “totals”.
7. **FE-004 / FE-203:** Extend `PaymentStatus` + all badges/filters for `partially_paid`.
8. **BE-005:** Decide and document tax-on-discount policy; if post-discount, recompute `taxAmount`/`serviceAmount` in `applyDiscount`.
9. **BE-009:** Single epsilon policy for refunds vs `paidTotal`.
10. **BE-011 / DB-005:** Partial unique index or transactional advisory lock for open cash shift.
11. **BE-012 / BE-013:** Finish expected-cash formula; enforce or remove variance threshold.

### P2 — Security & abuse

12. **BE-001:** Rate-limit authenticated staff (higher tiers, not zero).
13. **BE-007:** Drop `kitchen_staff` from payments GET.
14. **CFG-003:** Require MinIO keys via env; no default in prod.
15. **BE-008:** Generic 403 without role inventory.
16. **BE-010:** Prefer separate approver or explicit “self-approved” audit flag.

### P3 — Time & reports

17. **BE-002:** Compute week buckets with `formatInTimeZone` / `startOfWeek` in Cairo only — no bare `getDay` on zoned Dates.
18. **BE-003 / BE-004:** All day boundaries via `Africa/Cairo` helpers (attendance already has the pattern).
19. **PERF-001 / PERF-002:** SQL `SUM`/`COUNT` aggregates; stream or paginate large ranges.

### P4 — Quality gates

20. **CFG-009:** Fix 5 red tests (settings NaN fixtures, auth password fixture, stock Decimal, wire or delete `consumeForSale` expectation BE-014).
21. **BE-006:** Align cancel rules (API, error string, FE-204).
22. **FE-002 / FE-003:** Fix toast precedence; complete Order merge types.
23. **BE-022:** `if (!image) { cb(err,false); return; }`.
24. **CFG-006/008/010:** Re-enable unused-vars (error), ban new `any`, add money/status unit tests, fix i18n parity script in CI.

### P5 — Hygiene

25. Remove dead routes/methods or expose them deliberately (BE-021).
26. Delete or relocate loose SQL (DB-006); single lockfile; rename package (CFG-012/013).
27. Audit log on expense update (BE-017); menu optimistic concurrency (BE-018).

**Suggested verification after fixes:** clean Postgres → `migrate deploy` → seed → API tsc/jest green → FE tsc/eslint gate → vitest money/status suites → manual cashier partial-pay path.

---

## 16. Audit Limitations

1. **Read-only:** no source/DB/config changes; DB-001/DB-002 not repaired; shadow-database migrate remains broken.
2. **Live app not fully exercised:** no authenticated UI walk-through (no known working password beyond committed seeds — intentionally not used to mutate state); `/api/settings` 500 not re-probed after restart this pass.
3. **Port 8080 / Docker / MinIO:** unavailable — storage MinIO path and IIS-based access not verified at runtime (CFG-014).
4. **Subagent FE/DB reports truncated** in session capture; findings re-validated by direct reads/greps where cited; some speculative FE-2xx items from truncated agents were **not** entered unless confirmed (register only Confirmed/Probable/Needs Verification re-verified items).
5. **No load tests:** PERF findings are code-level.
6. **No dependency CVE scan** (`npm audit` / Snyk not run).
7. **Prior `AUDIT_REPORT.md`:** historical; where it conflicts with this snapshot, **this report (2026-09-24)** is authoritative.
8. **Jest/tsc/eslint results** are point-in-time on this working tree; uncommitted local changes (if any beyond session fixes) were not separated from HEAD.

---

*End of report. Severity counts in §1 match the §14 register (58 rows, unique IDs). Only `FULL_CODEBASE_AUDIT_REPORT.md` was created by this audit; no source, DB, or config files were modified.*
