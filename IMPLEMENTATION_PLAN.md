# Tasty Table — Phased Implementation Plan
> Companion to `PROJECT_GUIDE.md` (Phase 0 audit). Scope decisions confirmed by owner Aug 2026:
> per-stage timestamps + actors (no event sourcing) · dual-mode inventory (recipe BOM XOR unit-stock, per item) ·
> child Payment records (multi/partial) · single cafe-wide CashShift · configurable tax/service defaulting OFF ·
> **no branchId** · admin-only discounts.

---

## ⚠️ Residual ambiguities — resolve before Phase 1 migrations

| # | Question | Recommended default |
|---|---|---|
| A1 | One `actorId` on Order vs. **per-stage actor columns** ("alongside each transition" reads per-stage) | Per-stage: `preparingById`, `readyById`, `completedById`, `cancelledById` |
| A2 | Add `receivedAt` column? | No — reuse existing `createdAt` as receive time |
| A3 | **Who may cancel, until which stage?** (only discounts were scoped) | Admin-only in v1 (matches discount posture); cancellable until `ready` |
| A4 | Auto-restock ingredients on cancel? | No auto-restock v1 — physical consumption already happened; manual logged adjustment instead |
| A5 | Do variants alter recipes (large latte ≠ small)? | No in v1 — variants share the base recipe |
| A6 | Ingredient costing method | Moving weighted-average from purchases + manual initial cost |
| A7 | Payment taken with **no open cash shift**? | Allowed, stored unlinked; variance report flags orphan cash payments |
| A8 | Overpayment / change-given on cash | Record actual paid; `paidTotal > total` reported as change/surplus, never auto-clamped |
| A9 | Refund modeling | **Negative-amount Payment** (`reason` required, admin-only) — keeps all sums correct; alternative was separate Refund entity |
| A10 | "Cashier-settable tax/service at order time" — there is **no staff order-entry screen today** (orders originate on guest phones) | v1: admin presets in Settings applied server-side at order creation; per-order override deferred until a staff order-entry/bill-edit surface exists |
| A11 | Discount scope | Order-level only in v1 (no line-item discounts) |
| A12 | Non-order actions (menu price edits, user admin, expense/stock changes) also need attribution | Add generic `AuditLog` table — complements, doesn't replace, your stage-column decision |
| A13 | Existing orders during migration | Stage timestamps stay NULL for old rows; code treats NULL gracefully; `createdAt` remains the received time |
| A14 | Over-selling stock (complete order when ingredient insufficient) | v1: **allow negative**, log movement, raise low-stock alert — blocking order completion mid-rush is worse; strict mode later |

---

## Phase 1 — Foundations & Integrity *(prerequisite for every money feature)*

**Fixes carried from audit:** SEC-1 (client pricing), money Float, no enums, TOCTOU status races, missing actor capture, settings silent failure, pagination absence.

### Schema (migration 1.x)
```prisma
enum Role { admin kitchen_staff waiter }
enum OrderStatus { received preparing ready completed cancelled }

model Order {
  // …existing fields…
  status        OrderStatus @default(received)
  preparingAt   DateTime?   @map("preparing_at")
  preparingById String?
  readyAt       DateTime?
  readyById     String?
  completedAt   DateTime?
  completedById String?
  cancelledAt   DateTime?
  cancelledById String?
  cancelReason  String?
  // FK relations to User for each *_ById
}
// MenuItem.price / MenuItemVariant.priceAdjust / OrderItem.unitPrice → Decimal @db.Decimal(10,2)
// Index: @@index([createdAt]); DROP redundant @@index([orderNumber])
```

### Backend
1. **Server-authoritative pricing**: `create()` loads MenuItems+variants by ID, recomputes `unitPrice`, copies names from DB; unknown/unavailable item → 400. Strip price/name from public DTO acceptance.
2. **Race-safe transitions**: `updateMany({ where: { id, status: <expectedFrom> }, data })`; zero rows → 409 Conflict. Sets the matching `*At` + `*ById` pair from JWT actor.
3. **Cancel endpoint** `POST /orders/:id/cancel` (admin, reason required, until `ready`) per A3/A4.
4. **Prisma exception filter**: P2002→409, P2025→404, FK→400.
5. Settings: remove swallow-all try/catch (migration issue resolved); real errors surface.
6. `GET /orders` pagination: `?status&from&to&cursor&take≤100`.

### Frontend
- Kitchen/Waiter optimistic status updates + rollback (kills the 5s-lag double-tap problem).
- OrderHistory paginated/infinite; dashboard decoupled from full order list.
- Cancel action (admin OrderHistory only) with reason dialog.

**Tests:** pricing tampering attempt e2e (expect server price), illegal transitions incl. concurrency simulation, cancel rules, decimal serialization.
✅ *Checkpoint 1: review diff, run suites, load-test dashboard with seeded 50k orders.*

---

## Phase 2 — Totals, Tax/Service, Discounts, Payments

### Schema
```prisma
enum PaymentMethod { cash card wallet other }

model RestaurantSettings {
  taxEnabled     Boolean @default(false)
  taxRate        Decimal @db.Decimal(5,4) @default(0)   // e.g. 0.1400 = 14%
  serviceEnabled Boolean @default(false)
  serviceRate    Decimal @db.Decimal(5,4) @default(0)
}

model Order {
  itemsTotal     Decimal @db.Decimal(10,2) @default(0)
  discountAmount Decimal @db.Decimal(10,2) @default(0)
  discountReason String?
  discountedById String?
  taxRate        Decimal @db.Decimal(5,4) @default(0)   // snapshot at creation (settings preset, A10)
  taxAmount      Decimal @db.Decimal(10,2) @default(0)
  serviceRate    Decimal @db.Decimal(5,4) @default(0)
  serviceAmount  Decimal @db.Decimal(10,2) @default(0)
  total          Decimal @db.Decimal(10,2) @default(0)
  paidTotal      Decimal @db.Decimal(10,2) @default(0)
  payments       Payment[]
}

model Payment {
  id          String        @id @default(uuid())
  orderId     String
  order       Order         @relation(fields:[orderId], onDelete:Restrict)
  amount      Decimal       @db.Decimal(10,2)   // negative = refund (A9)
  method      PaymentMethod
  actorId     String?
  cashShiftId String?       // linked in Phase 3
  reason      String?       // required when amount<0
  paidAt      DateTime      @default(now())
  note        String?
  @@index([orderId])
  @@index([method, paidAt])
}
```

### Backend
- Totals computed server-side once at creation (itemsTotal/tax/service/total from settings snapshot); discount endpoint `POST /orders/:id/discount` (**admin-only**, reason required, writes `discountedById`, recomputes `total`, AuditLog entry per A12).
- Payment endpoints: add payment (any staff), refund (admin, negative, guarded `Σpayments ≥ refund`), all inside `$transaction` maintaining `paidTotal`.
- Public tracker projection: totals shown; payment internals NOT exposed.

### Frontend
- Waiter bill panel: totals breakdown + "Record payment" (method picker, multi-payment support, running balance).
- BrandingSettings: tax/service toggles + rates.
- Guest order-status page: show total + paid badge.

**Tests:** totals math incl. rounding (banker's vs half-up — we use half-up at 2dp), partial+split payments, refund guard, discount permission denial for non-admin.
✅ *Checkpoint 2.*

---

## Phase 3 — Cash Shifts

### Schema
```prisma
enum CashMovementType { paid_in paid_out }

model CashShift {
  id             String   @id @default(uuid())
  status         String   @default("open")   // open|closed
  openedAt       DateTime @default(now())
  openedById     String
  openingFloat   Decimal  @db.Decimal(10,2)
  closedAt       DateTime?
  closedById     String?
  expectedAmount Decimal?  // frozen at close
  countedAmount  Decimal?
  variance       Decimal?
  note           String?
  movements      CashMovement[]
  payments       Payment[]
  @@index([openedAt])
}
// Partial unique index (raw SQL in migration — Prisma can't express it):
// CREATE UNIQUE INDEX one_open_cash_shift ON "CashShift"("status") WHERE (status = 'open');

model CashMovement {
  id          String           @id @default(uuid())
  cashShiftId String
  type        CashMovementType
  amount      Decimal          @db.Decimal(10,2)
  note        String
  actorId     String
  createdAt   DateTime         @default(now())
}
```

### Rules (encoded in service)
- Open/close = **admin-only** (assumption — confirm with A-list answer or override).
- Expected = float + Σcash payments − |Σcash refunds| + ΣpaidIn − ΣpaidOut (frozen transactionally at close).
- New cash payment during close transaction → rejected (409) to avoid split-brain.
- Unlinked payments (A7) appear in a "orphans" warning strip on the close screen.

### Frontend
Admin: Shifts screen (open with float → live expected counter → close with counted input + variance display, confirm dialog). Dashboard card: "Drawer: expected X".

**Tests:** concurrent-close race, expected math with refunds/paid-outs, one-open-shift constraint, orphan payments path.
✅ *Checkpoint 3.*

---

## Phase 4 — Dual-Mode Inventory

### Schema
```prisma
enum StockMode { none units recipe }        // per-item toggle (owner decision)
enum MovementReason { initial purchase sale waste adjustment cancel_restock }

model InventoryItem {
  id          String   @id @default(uuid())
  nameAr      String
  nameEn      String
  unit        String                       // g | ml | pc
  qtyOnHand   Decimal  @db.Decimal(12,3) @default(0)
  minQty      Decimal  @db.Decimal(12,3) @default(0)
  avgUnitCost Decimal  @db.Decimal(10,4) @default(0)  // weighted avg (A6)
  deletedAt   DateTime?
  @@index([deletedAt])
}

model RecipeLine {
  id              String        @id @default(uuid())
  menuItemId      String
  inventoryItemId String
  quantity        Decimal       @db.Decimal(12,3)   // per 1 × sold item
  @@unique([menuItemId, inventoryItemId])
}
// MenuItem gains: stockMode StockMode @default(none)

model StockMovement {
  id              String         @id @default(uuid())
  inventoryItemId String
  delta           Decimal        @db.Decimal(12,3)  // signed
  reason          MovementReason
  refType         String?                            // 'order' | 'purchase'
  refId           String?
  actorId         String?
  note            String?
  createdAt       DateTime       @default(now())
  @@index([inventoryItemId, createdAt])
}

model Purchase  { id, supplierName?, purchasedById, purchasedAt, note?, lines PurchaseLine[] }
model PurchaseLine { id, purchaseId, inventoryItemId, quantity Decimal(12,3), unitCost Decimal(10,4) }
```
**Invariant (service-enforced, A5):** `stockMode='units'` ⇔ exactly one RecipeLine (UI presents it as "unit stock"); `'recipe'` ⇔ ≥1 lines; `'none'` ⇔ 0 lines. DB can't express line-count rules — validated in service + UI editor shapes.

### Engine
- On `updateStatus → completed` ($transaction): for each item, per stockMode, write negative `StockMovement(reason=sale, ref=orderId)` and decrement `qtyOnHand` (A13/A14: negatives allowed + alert).
- Purchases: create lines → weighted-average cost update → positive movement.
- Waste/adjustment: manual, actor-attributed, reason'd.
- Reports: consumed-by-sales (movements grouped), low-stock list (`qtyOnHand <= minQty`), stock valuation (avgUnitCost × qty).

### Frontend
Admin: Inventory list (levels, low-stock badges), item editor with **mode toggle** that swaps between single-unit editor and recipe-line editor, purchases form, waste/adjust dialog. MenuManagement: per-item mode indicator.
⚠️ Migration behavior for **existing MenuItems** → `stockMode='none'` (nothing tracked until owner opts in) — safe default.

**Tests:** deduction math with quantities, mode-invariant violations rejected, purchase cost averaging, concurrent completions not double-deducting.
✅ *Checkpoint 4.*

---

## Phase 5 — Expenses, Profitability, Reporting Upgrade

### Schema
```prisma
model Expense {
  id            String    @id @default(uuid())
  category      String                        // rent, salaries, supplies…
  amount        Decimal   @db.Decimal(10,2)
  spentAt       DateTime
  note          String?
  receiptUrl    String?                       // reuses upload pipeline
  recordedById  String
  deletedAt     DateTime?
  @@index([spentAt])
}

model AuditLog {
  id        String   @id @default(uuid())
  actorId   String?
  action    String                       // 'menu.price_change', 'user.deactivate', 'expense.create'…
  entity    String
  entityId  String?
  meta      Json?
  createdAt DateTime @default(now())
  @@index([entity, entityId])
  @@index([createdAt])
}
```

### Work
- Expense CRUD (admin) + daily/monthly summaries.
- **Profitability per product** = revenue(server-priced, Phase 1) − cost (units: `avgUnitCost × qty`; recipe: Σlines; untracked items excluded & listed as "unknown cost").
- Rewrite reports/dashboard aggregates in **SQL** (`groupBy/aggregate`) — retires PF-1/PF-2 scan-everything patterns; prep-time report from stage timestamps (median/p90 per stage, filter excludes cancelled per A3 policy decision).
- Audit trail viewer (admin, filterable) fed by interceptor on privileged mutations.

### Frontend
Reports tabs: Sales / Products (profit!) / Prep-Time / Expenses / P&L-lite (revenue − COGS − expenses). Audit viewer under Staff section.

**Tests:** profit math across modes, aggregate parity vs JS fixtures, audit interceptor coverage.
✅ *Checkpoint 5: full regression + staged production rollout.*

---

## Dependency graph

```
P1 ──► P2 ──► P3
 │      └────► P4 ──► P5
 └───────────────────▲
      (P4 needs P1 pricing+decimals; P5 needs P4 costs)
```

## Cross-cutting (every phase)
- Migrations are additive-first; destructive steps (Float→Decimal) get shadow-column + backfill strategy documented in the migration file.
- Every privileged endpoint: `@Roles()` + AuditLog where applicable.
- Suites green before checkpoint; new modules ship with unit tests (backend coverage target ≥60% on services by P3).
