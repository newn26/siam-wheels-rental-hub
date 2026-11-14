# Admin Customers Tab (view only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A view-only "ข้อมูลลูกค้า" tab in the admin dashboard listing customers with search and a detail dialog (profile + booking history).

**Architecture:** Pure data shaping in `src/lib/customers.ts` (unit tested). A presentational panel `src/components/admin/customers-panel.tsx` receives data `admin.tsx` already loads; `admin.tsx` only adds the tab and passes props. No new queries, no database change.

**Tech Stack:** React 19, TanStack Router/Query, shadcn/ui (table, dialog, input, badge, button), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-14-admin-customers-tab-design.md`

## Global Constraints

- No edits to `supabase/migrations/`, `drizzle/`, or generated files (`src/routeTree.gen.ts`, `src/integrations/supabase/types.ts`).
- No new Supabase queries; reuse `profiles`, `bookings` (with `cars`), `payments`, `user_roles` from `admin.tsx`.
- UI copy in Thai; money via `thb()`, dates via `fmtDate()`, booking status via `bookingStatusLabel` (all in `src/lib/format.ts`).
- Tab visible whenever `perms.viewDashboard` is true. No edit/suspend/delete actions.
- Do not commit unless the user asks.

## Review Focus

1. Profile with empty `full_name` → shown as `(ไม่ระบุชื่อ)`, still searchable by phone.
2. Customer with no bookings → count `0`, total `฿0`, dialog shows `ยังไม่มีการจอง`.
3. Paid payment on a cancelled booking → not included in total paid.
4. Phone search typed with dashes/spaces (`081-234`) → matches stored `0812345678`.
5. Booking whose car was deleted (`cars: null`) → dialog row shows `-` for the car, no crash.

---

### Task 1: Customer data helpers

**Files:**
- Create: `src/lib/customers.ts`
- Test: `src/test/customers.test.ts`

**Interfaces:**
- Consumes: `isRevenuePayment`, `bookingStatusMap`, `ReportPayment`, `ReportRole` from `src/lib/reports.ts`.
- Produces:
  ```ts
  export type CustomerProfile = {
    id: string; full_name: string; phone: string | null; address: string | null;
    license_no: string | null; id_card_no: string | null; created_at?: string | null;
  };
  export type CustomerBooking = {
    id: string; user_id: string; booking_code: string; status: string;
    start_date: string; end_date: string; total_amount: number | string; created_at: string;
    cars: { brand: string; model: string; plate_no: string } | null;
  };
  export type CustomerRow = {
    profile: CustomerProfile;
    bookings: CustomerBooking[];   // this customer's, newest created_at first
    bookingCount: number;
    totalPaid: number;
  };
  export const NO_NAME = "(ไม่ระบุชื่อ)";
  export function buildCustomerRows(input: {
    profiles: CustomerProfile[]; bookings: CustomerBooking[];
    payments: ReportPayment[]; roles: ReportRole[];
  }): CustomerRow[];
  export function filterCustomers(rows: CustomerRow[], query: string): CustomerRow[];
  export function maskId(value: string | null | undefined): string;
  ```

- [ ] **Step 1: Write the failing tests** in `src/test/customers.test.ts` (fictional data):
  - `buildCustomerRows excludes admin and demo_admin users` — profiles `c1`, `a1`, `d1`; roles `a1:admin`, `d1:demo_admin`, `c1:customer` → ids `["c1"]`.
  - `buildCustomerRows keeps a profile with no role row` — profile `c2`, roles `[]` → one row for `c2`.
  - `sorts newest sign-up first, missing created_at last` — created_at `2026-01-01`, `2026-06-01`, `undefined` → order `[jun, jan, missing]`.
  - `counts bookings and sorts them newest first` — two bookings for `c1` → `bookingCount 2`, `bookings[0]` is the later `created_at`.
  - `totalPaid counts only revenue payments` — `c1` booking `b1` completed with paid 1500, booking `b2` cancelled with paid 900, booking `b3` confirmed with payment status `pending` 500 → `totalPaid 1500`. Amount given as string `"1500"` still sums to `1500`.
  - `customer without bookings has zero totals` → `bookingCount 0`, `totalPaid 0`, `bookings []`.
  - `filterCustomers empty or blank query returns all rows`.
  - `filterCustomers matches name case-insensitively and Thai substrings` — `"สมชาย"` matches `"สมชาย ใจดี"`; `"JOHN"` matches `"John Doe"`.
  - `filterCustomers matches phone ignoring dashes and spaces` — `"081-234"` and `"081 234"` match phone `"0812345678"`; `"999"` does not.
  - `maskId keeps the last 4 characters` — `"1-2345-67890-12-3"` → `"x-xxxx-xxxx0-12-3"`; `"AB123456"` → `"xxxx3456"`; `""`, `null` → `"-"`; `"123"` → `"123"`.

- [ ] **Step 2: Run tests to verify they fail**
  Run: `npx vitest run src/test/customers.test.ts`
  Expected: FAIL (cannot resolve `@/lib/customers`).

- [ ] **Step 3: Implement `src/lib/customers.ts`**
  - Admin exclusion: set of `user_id` with role `admin` or `demo_admin`.
  - Total paid: payment belongs to a customer through `booking_id → booking.user_id`; include when `isRevenuePayment(p, bookingStatusMap(bookings))`; sum `Number(p.amount)`.
  - Phone match: strip `/\D/g` from query and phone; only phone-match when the stripped query is non-empty. Name match: `full_name.toLowerCase().includes(query.trim().toLowerCase())`.
  - `maskId`: replace every letter/digit except the last 4 letters/digits with `x`, keep separators; return `"-"` for empty/null.

- [ ] **Step 4: Run tests to verify they pass**
  Run: `npx vitest run src/test/customers.test.ts`
  Expected: all PASS.

---

### Task 2: Customers panel and dashboard tab

**Files:**
- Create: `src/components/admin/customers-panel.tsx`
- Modify: `src/routes/admin.tsx` (type `AdminTab` line ~124, sidebar list ~838-846, tab content after the bookings tab ~1335)
- Test: `src/test/admin-dashboard.test.tsx` (add cases), new `src/test/customers-panel.test.tsx`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `export function AdminCustomersPanel(props: { rows: CustomerRow[] }): JSX.Element`.

- [ ] **Step 1: Write the failing panel tests** in `src/test/customers-panel.test.tsx` (render `AdminCustomersPanel` with rows built by `buildCustomerRows`):
  - `lists customers with count, total and heading` — heading text `ข้อมูลลูกค้า (2)`; row shows `สมชาย ใจดี`, phone, `2`, `thb(1500)` text.
  - `shows placeholder for a missing name` — `full_name: ""` row shows `(ไม่ระบุชื่อ)`.
  - `search filters rows` — type `081-234` into input with placeholder `ค้นหาชื่อ หรือเบอร์โทร...` → only the matching customer remains; type `zzz` → text `ไม่พบลูกค้า`.
  - `detail dialog shows masked ids and booking history` — click `ดู` on the first row → dialog shows address, masked ID card (`maskId` output) and not the raw number; clicking `แสดง` shows the raw number; booking code and `bookingStatusLabel` label are listed; a booking with `cars: null` shows `-` in the car cell.
  - `detail dialog for customer without bookings` → text `ยังไม่มีการจอง`.

- [ ] **Step 2: Add a failing dashboard test** in `src/test/admin-dashboard.test.tsx` using the existing `renderDashboard` with an admin: sidebar button `ข้อมูลลูกค้า` exists; clicking it shows `ทดสอบ ลูกค้าเอ` and does not list the `admin-1` user.

- [ ] **Step 3: Run tests to verify they fail**
  Run: `npx vitest run src/test/customers-panel.test.tsx src/test/admin-dashboard.test.tsx`
  Expected: FAIL (module not found / button not found).

- [ ] **Step 4: Implement `AdminCustomersPanel`**
  - `Card` with title `ข้อมูลลูกค้า ({filtered.length})`, description `ดูข้อมูลและประวัติการเช่าของลูกค้า (ดูอย่างเดียว)`, search `Input`.
  - `Table` columns: `ชื่อ`, `เบอร์โทร`, `การจอง`, `ชำระแล้ว`, `สมัครเมื่อ`, action button `ดู`. Empty filtered list → `ไม่พบลูกค้า`.
  - `Dialog` for the selected row: name, phone, address, `เลขใบขับขี่`, `เลขบัตรประชาชน` (masked; one `แสดง`/`ซ่อน` toggle for both, reset when the dialog closes), then a booking table (`รหัสการจอง`, `รถ` as `brand model (plate_no)` or `-`, `วันที่เช่า` as `fmtDate(start) – fmtDate(end)`, `ยอด`, `สถานะ` via `bookingStatusLabel`). No bookings → `ยังไม่มีการจอง`.
  - Follow the styling of `src/components/admin/reviews-panel.tsx`.

- [ ] **Step 5: Wire into `src/routes/admin.tsx`**
  - Add `"customers"` to `AdminTab`.
  - Sidebar item after `bookings`: `{ id: "customers", label: "ข้อมูลลูกค้า", icon: Users, count: customerRows.length }` (`Users` from `lucide-react`; reuse if already imported).
  - `const customerRows = useMemo(() => buildCustomerRows({ profiles, bookings, payments, roles }), [profiles, bookings, payments, roles]);`
  - Render `{activeTab === "customers" && <AdminCustomersPanel rows={customerRows} />}` after the bookings tab block.

- [ ] **Step 6: Run the tests, the full suite, lint and type check**
  Run: `npx vitest run src/test/customers-panel.test.tsx src/test/admin-dashboard.test.tsx` → PASS.
  Run: `npm test` → no new failures vs. before the change (note any pre-existing failures, e.g. DB tests needing a database).
  Run: `npx tsc --noEmit` and `npx eslint src/lib/customers.ts src/components/admin/customers-panel.tsx src/routes/admin.tsx` → no new errors.

- [ ] **Step 7: Check in the running app** (`npm run dev`, sign in as an admin, open the tab) if an admin account is available; otherwise say it was verified by tests only.
