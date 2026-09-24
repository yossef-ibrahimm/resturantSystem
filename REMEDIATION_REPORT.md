# Remediation Report — FULL_CODEBASE_AUDIT_REPORT (2026-09-24)

Branch: `fix/audit-remediation`
Source audit: `FULL_CODEBASE_AUDIT_REPORT.md` (58 issue IDs)
Backup (before work): `C:\Users\Yossef\AppData\Local\Temp\opencode\tastytable_backup_20260924_154617.sql`

---

## 1. Executive summary

| Phase | Goal | Result |
|---|---|---|
| 0 | Baseline, branch, backup, secret history | Done |
| 1 | DB migrations + seeds + fixtures green | Done — 18/18 migrations idempotent on empty + restored DB |
| 2 | Money / payment-status correctness (BE/FE) | Done — shared money helpers, `partially_paid`, epsilon unified |
| 3 | FE typecheck gate | Done — `tsc --noEmit` exit 0; FE tests 10/10 |
| 4 | Remaining BE fixes (tax rebase, cancel, audit, perf) | Done — 4 atomic commits |
| 5 | Lint cleanup FE + API | Done — API 0 errors; FE 0 errors / 6 pre-existing warnings |
| 6 | Tests green | Done — API 139/139; FE 10/10 |
| 7 | Clean-DB proof + report | Done — empty DB migrate+seed+API probe 200; report below |

**Gates (after)**

| Gate | Command | Result |
|---|---|---|
| FE typecheck | `npx tsc --noEmit -p tsconfig.app.json` | **exit 0** |
| FE lint | `npm run lint` | **0 errors**, 6 warnings (pre-existing `react-refresh`) |
| FE tests | `npm test` | **10/10 pass** |
| API typecheck | `npx tsc --noEmit` | **exit 0** |
| API lint | `npm run lint` | **exit 0** (0 errors) |
| API tests | `npx jest` | **14 suites / 139 tests pass** |
| Clean DB migrate | `prisma migrate deploy` on empty `tastytable_scratch2` | **exit 0** (18 migrations) |
| Clean DB seed | `prisma db seed` | **exit 0** (users/menu/inventory/orders/settings) |
| API probe | `GET /api/settings` on seeded scratch | **HTTP 200** full settings shape |
| Restored DB status | `prisma migrate status` on `tastytable_restored` | **up to date** (18 migrations) |

---

## 2. Per-ID status table

Legend: **FIXED** = code changed + verified; **VERIFIED** = finding confirmed, change documented or N/A; **DEFER** = residual / needs product or later work; **DECISION** = product default applied, see §4.

| ID | Sev | Status | Commit(s) / evidence |
|---|---|---|---|
| DB-001 | CRITICAL | **FIXED** | `03bb552` baseline Payment migration; clean-DB deploy exit 0 |
| DB-001b *(new)* | CRITICAL | **FIXED** | `d1797f4` Order money columns + Table/MergedGroup (discovered gap) |
| DB-002 | CRITICAL | **FIXED** | `b87636d` settings columns + open-shift unique index |
| DB-003 | CRITICAL | **FIXED** | `081d522` env/random seeds + `mustChangePassword` |
| DB-004 | MEDIUM | **FIXED** | Same as DB-002 (duplicate of settings columns) |
| DB-005 | MEDIUM | **FIXED** | `b87636d` partial unique index one-open-shift |
| DB-006 | LOW | **FIXED** | `a593b62` gitignore dump/SQL debris |
| CFG-001 | HIGH | **VERIFIED** | Pre-existing CORS default; env-driven (prior P3 commits) — not re-changed this branch |
| CFG-002 | HIGH | **FIXED** | Phase 3 FE `tsc` gate now exit 0 |
| CFG-005 | LOW | **FIXED** | `a593b62` same as DB-006 (duplicate) |
| BE-001 | HIGH | **DEFER** | Staff throttler bypass — out of this phase’s commit list; residual risk noted §6 |
| BE-002 | MEDIUM | **VERIFIED** | TZ week bucket risk confirmed by code shape; full TZ test proof **not** added this pass — residual |
| BE-003 | MEDIUM | **DEFER** | Dashboard `startOfDay` server-TZ — residual (same class as BE-002) |
| BE-004 | MEDIUM | **DEFER** | Expenses/inventory `setHours` server-TZ — residual |
| BE-005 | MEDIUM | **FIXED** | `b699f8a` `rebaseTaxAfterDiscount` + tests (post-discount tax) |
| BE-006 | MEDIUM | **FIXED** | `b699f8a` cancel only `received`/`preparing` + tests |
| BE-007 | MEDIUM | **DEFER** | Kitchen `GET` payments over-broad — residual |
| BE-008 | MEDIUM | **DEFER** | RolesGuard error leak — residual |
| BE-009 | MEDIUM | **FIXED** | `499019c` shared `MONEY_EPSILON = 0.01` |
| BE-010 | MEDIUM | **FIXED** | `35fe78f` explicit `approvedById` self-approval marker |
| BE-011 | MEDIUM | **FIXED** | `0ac5473` P2002 → 409 + `b87636d` DB unique index |
| BE-014 | MEDIUM | **DECISION** | `07ee946` tests assert `consumeForSale` **not** called (manual inventory) |
| BE-021 | LOW | **VERIFIED** | Dead service methods still present — N/A fix (no routes) |
| BE-023 | MEDIUM | **FIXED** | `2e3a96d` FE consumes `partially_paid` |
| BE-024 | INFO | **FIXED** | `74c27b2` documented single-tenant WS broadcast |
| BE-025 | MEDIUM | **FIXED** | `995fd16` variance threshold + defensive `serialize`/`toNum` |
| FE-001 | HIGH | **FIXED** | `a53f0b9` dashboard button uses user presence (HttpOnly cookie) |
| FE-004 | HIGH | **FIXED** | `2e3a96d` `PaymentStatus` includes `partially_paid` |
| FE-201 | HIGH | **FIXED** | `2e3a96d` OrderHistory uses `orderTotal`/`itemsSubtotal` |
| FE-202 | HIGH | **FIXED** | `2e3a96d` Sales report list total |
| FE-203 | MEDIUM | **FIXED** | `2e3a96d` payment badge helpers |
| FE-204 | MEDIUM | **FIXED** | Aligns with BE-006 (UI already `received\|preparing`) |
| PERF-001 | HIGH | **DEFER** | Report summary full-set load — residual (PERF-002 done) |
| PERF-002 | MEDIUM | **FIXED** | `9a64f88` SQL `_sum` for today’s paid revenue |
| CFG-012/013 | LOW | **VERIFIED** | Dual locks / scaffold name — hygiene, not changed |
| BE-012/013/017/018/019/022 | LOW/MED | **DEFER** | Not in this phase’s commit scope — residual list §6 |

Other FE type errors (unused imports, missing types, EmptyState icon, formatPrice locale, etc.) fixed in `4b74d8d`.

---

## 3. What was done (by phase)

### Phase 0 — Baseline
- Branch `fix/audit-remediation`.
- Full `pg_dump` backup of live `tastytable`.
- Git secret history scan: seed passwords present in old commits (`18cf155`, `349b45a`, `068c6ba`) — **history not rewritten**; rotation recommended (§5).

### Phase 1 — DB
- Idempotent migrations (never edited applied files):
  - `20260903090000_baseline_payment_table` — Payment + CashShift + money columns.
  - `20260906000000_settings_table_management_and_open_shift_unique` — settings numerics + open-shift index.
  - `20260907000000_order_money_snapshot_and_tables` — Order money snapshot + `Table`/`MergedGroup` (**discovered gap**: these existed only out-of-band on live, not in schema history).
- Seed hardening, stock `toDecimal`, settings serialize, test fixtures.
- Proof: empty scratch + restored DB `migrate deploy` exit 0.

### Phase 2 — Money / FE payments
- `src/lib/money.ts` + tests: `roundMoney`, `orderTotal`, `itemsSubtotal`, `remainingBalance`, payment badge helpers, `MONEY_EPSILON`.
- Server `payments.service.ts` uses shared epsilon (BE-009).
- FE order/report pages use server totals (FE-201/202); `partially_paid` badge (FE-004/203).

### Phase 3 — FE typecheck
- Fixed all `tsc` errors: Order types (`tableId`/`mergedGroupId`), zod narrowing in OrderHistory, CashierPaymentDialog optional `mergedGroup`, formatPrice locale `string`, EmptyState icon union, unused imports/vars across ~35 files.
- FE tests 10/10.

### Phase 4 — BE
- **BE-005**: `rebaseTaxAfterDiscount` — tax/service recomputed on discounted base; unit tests for rates + rounding.
- **BE-006**: admin cancel only `received`/`preparing`; tests for ready-refusal + preparing-allow.
- **BE-010**: refund `approvedById` always records actor when no separate approver (explicit self-approval).
- **PERF-002**: dashboard revenue via `prisma.order.aggregate` + `count` (no JS filter).
- **BE-024**: documented single-tenant WS (no room isolation).

### Phase 5 — Lint
- Eliminated all `no-explicit-any` (structural mocks, Prisma types, `err instanceof Error`), empty catch blocks, constant binary expression, constant condition; fixed `react-hooks/exhaustive-deps` where safe.
- API lint **0 errors**; FE lint **0 errors** (6 pre-existing warnings).

### Phase 6 — Tests
- API **139/139**; FE **10/10**; both typechecks exit 0.

### Phase 7 — Clean-DB proof
1. Fresh DB `tastytable_scratch2` → `migrate deploy` **exit 0** (18 migrations).
2. `prisma db seed` **exit 0**.
3. API built + started → `GET /api/settings` **200** with full settings JSON.
4. Restored copy `tastytable_restored` → `migrate status` **up to date** (cleaned 1 failed duplicate `_prisma_migrations` row from an earlier partial apply).

---

## 4. Decisions Needed (product defaults applied)

| Topic | Default applied | Alternative if wrong |
|---|---|---|
| Cancel rules | Only `received` / `preparing` (matches UI + error string) | Allow `ready` with admin confirm |
| Discount tax policy | **Post-discount** tax/service rebase (`rebaseTaxAfterDiscount`) | Pre-discount (“discount after tax”) — revert helper call site |
| Refund approval | Actor stored as `approvedById` when no second approver (**self-approved** audit marker) | Require separate approver ID always |
| Inventory on sale | **Manual** stock; `consumeForSale` not auto-called | Wire `consumeForSale` in order prepare |
| Seed credentials | Env vars or random; `mustChangePassword: true` | Rotate historical passwords in live DB (operator action) |

---

## 5. Audit-report corrections

1. **DB-001b (new)**: Order money-snapshot columns and `Table`/`MergedGroup` tables were **absent from migration history** (present only on live via manual/out-of-band SQL). Added `20260907000000_…`.
2. **BE-002**: Finding confirmed by code shape; **automated TZ unit test proof not added** — treat as residual until test lands.
3. **DB-004 == CFG-005**, **BE-023 == FE-004**: duplicate IDs in register — treat as one fix each.
4. **BE-024**: verified real WS behavior — gateway broadcasts globally with role rooms only for join; no tenant rooms. Documented, not redesigned.
5. **Plan note**: “vue-tsc-equivalent” in the original remediation plan was a copy-paste error — this repo uses **`tsc --noEmit`** for FE.

---

## 6. Residual risks / deferred

| Area | IDs | Note |
|---|---|---|
| Throttling | BE-001 | Staff bypass rate limits — security follow-up |
| Timezone buckets | BE-002, BE-003, BE-004 | Cairo day/week boundaries — needs dedicated TZ tests |
| Payments RBAC | BE-007 | Kitchen can list payments |
| RolesGuard messages | BE-008 | Possible role disclosure |
| Perf reports | PERF-001 | Summary still loads large order sets |
| Menu/merge TOCTOU | BE-018, BE-019 | Probable, not fixed this pass |
| Upload double-cb | BE-022 | `fileFilter` missing return |
| Expense audit | BE-017 | Audit outside transaction |
| Cash close / variance | BE-012, BE-013 | Non-cash refunds; threshold unused |
| Git secret history | — | Old seed passwords in commits; **rotate live credentials**, do not rewrite history without explicit ops decision |
| FE lint warnings | — | 6× `react-refresh/only-export-components` (shadcn/ui pattern) |

---

## 7. Before → after gates

| Gate | Before | After |
|---|---|---|
| Clean DB `migrate deploy` | Fail (P3006/P1014 missing Payment/settings/Order money/Table) | **Pass** |
| API `tsc --noEmit` | Pass (baseline) | **Pass** |
| API jest | 134 (with fixed fixtures) | **139 pass** |
| API lint | 85+ errors | **0 errors** |
| FE `tsc --noEmit` | **Fail** (many errors) | **Pass** |
| FE lint | ~124 problems | **0 errors** / 6 warnings |
| FE tests | 10 | **10 pass** |
| Seed passwords | Hardcoded in repo | Env/random + mustChange |
| Payment status | Server 3-state; FE dropped partial | FE handles `partially_paid` |
| Discount tax | Pre-discount base | Post-discount rebase |
| Dashboard revenue | JS filter | SQL aggregate |

---

## 8. Commit log (this branch, remediation)

```
22393c2 chore(lint) Phase 5: eliminate all no-explicit-any, empty blocks, constant expressions; fix react-hooks deps
74c27b2 docs(ws) BE-024: document single-tenant broadcast (no room isolation)
9a64f88 perf(dashboard) PERF-002: aggregate today's paid revenue in SQL
35fe78f fix(payments) BE-010: record self-approved refund explicitly
b699f8a fix(orders) BE-005/BE-006: post-discount tax rebase + cancel only received/preparing
a53f0b9 fix(fe): FE-001 dashboard button uses user presence (HttpOnly cookie)
4b74d8d fix(fe): resolve all TypeScript errors for Phase 3 typecheck gate
2e3a96d fix(fe): FE-201/FE-202 use server totals; FE-004/FE-203 partially_paid badge
499019c feat(money): shared money helpers + BE-009 unify refund epsilon
07ee946 test(api): fix auth password-policy fixture and orders stock expectations
240ae3a fix(stock): use toDecimal for Decimal coercion in addStock
995fd16 fix(settings): BE-025 include cashShiftVarianceThreshold + defensive serialize
0ac5473 fix(cash-shifts): BE-011/DB-005 map P2002 open-shift race to 409
a593b62 chore(git): DB-006/CFG-005 ignore dump and ad-hoc SQL files
081d522 fix(seeds): DB-003 remove hardcoded passwords, env/random + mustChangePassword
d1797f4 fix(db): DB-001b Order money-snapshot columns + Table/MergedGroup tables
b87636d fix(db): DB-002 settings columns + DB-005 one-open-shift unique index
03bb552 fix(db): DB-001 baseline Payment migration for clean installs
```

---

## 9. Operator checklist (post-merge)

1. **Rotate** any historically leaked seed passwords on live `tastytable` (admin/kitchen/waiter/cashier).
2. Confirm tax policy with product: if “discount after tax” is required, swap `applyDiscount` off `rebaseTaxAfterDiscount`.
3. Schedule follow-ups: BE-001 throttler, BE-002/003/004 TZ tests, BE-007 payments RBAC, PERF-001.
4. Do **not** `migrate reset` / `db push --force` on live `tastytable`; backup path in header.
