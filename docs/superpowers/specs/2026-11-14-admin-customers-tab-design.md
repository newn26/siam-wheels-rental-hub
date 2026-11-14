# Admin customers tab (view only) — design

Date: 2026-11-14 · Size: small change

## Intent

Admins need one place to look up a customer: who they are, how to reach them, and what they have
rented. Today customer data (`profiles`) is only used to show names on bookings. This change is
**view only**. Suspending or deleting customers is a later request.

## Goals

- New admin dashboard tab "ข้อมูลลูกค้า", next to the bookings tab, visible to every admin
  (`perms.viewDashboard`).
- Customers only: profiles whose user has no `admin` or `demo_admin` role. (Claude's call: this
  keys off profiles rather than the `customer` role row the overview counts, so a profile missing
  its role row still shows up.)
- Table: name, phone, booking count, total paid, sign-up date, [ดู] button.
- Search by name or phone.
- Detail dialog: full profile (address, driving licence, ID card) and the customer's full booking
  history with statuses.

## Non-goals

- No editing, suspending or deleting customers.
- No database change. Nothing for Lovable (AGENTS.md: schema changes go through Lovable, and the
  friend who owns the Lovable project is not involved in this change).
- No email column: emails live in `auth.users`, which the browser cannot read.

## Constraints

- Reuse the queries `admin.tsx` already runs (`profiles`, `bookings` with cars, `payments`,
  `user_roles`). No new requests.
- RLS already lets admins read every profile.

## Approaches

1. **Tab inside the existing admin dashboard (chosen).** Data is already loaded there, and the
   tab gets the dashboard's permission and load-error handling for free.
2. Separate `/admin/customers` route. Rejected: it would load the same data again and duplicate
   the auth/permission gate.
3. Server function with the service role (would allow emails). Rejected for now: more surface for
   a view-only need.

## Decided

- Layout and columns as above, as agreed in conversation.
- "Total paid" uses the reports rule `isRevenuePayment` (payment `paid` and booking confirmed,
  active or completed), so a refunded/cancelled booking is not counted.

## Claude's calls

- ID card and driving licence numbers are masked by default in the dialog (last 4 visible), with
  a "แสดง" toggle. Reason: personal data on a shared admin screen.
- Pure logic (customer filtering, per-customer totals, search, masking) goes in
  `src/lib/customers.ts` with unit tests; UI in `src/components/admin/customers-panel.tsx`.
- Sorted by sign-up date, newest first.

## Left to the builder

- Exact styling, matching the other admin panels (shadcn table, dialog, badges, Thai labels).
