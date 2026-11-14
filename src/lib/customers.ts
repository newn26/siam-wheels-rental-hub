import {
  bookingStatusMap,
  isRevenuePayment,
  type ReportPayment,
  type ReportRole,
} from "@/lib/reports";

export type CustomerProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  license_no: string | null;
  id_card_no: string | null;
  created_at?: string | null;
};

export type CustomerBooking = {
  id: string;
  user_id: string;
  booking_code: string;
  status: string;
  start_date: string;
  end_date: string;
  total_amount: number | string;
  created_at: string;
  cars: { brand: string; model: string; plate_no: string } | null;
};

export type CustomerRow = {
  profile: CustomerProfile;
  /** This customer's bookings, newest created_at first. */
  bookings: CustomerBooking[];
  bookingCount: number;
  totalPaid: number;
};

export const NO_NAME = "(ไม่ระบุชื่อ)";

const STAFF_ROLES = new Set(["admin", "demo_admin"]);

const time = (d: string | null | undefined) =>
  d ? new Date(d).getTime() : Number.NEGATIVE_INFINITY;

/**
 * One row per customer. A customer is any profile whose user has no admin/demo_admin role,
 * so a profile missing its role row still shows up. Total paid follows the reports rule:
 * paid payments on bookings that are still confirmed, active or completed.
 */
export function buildCustomerRows(input: {
  profiles: CustomerProfile[];
  bookings: CustomerBooking[];
  payments: ReportPayment[];
  roles: ReportRole[];
}): CustomerRow[] {
  const staff = new Set(input.roles.filter((r) => STAFF_ROLES.has(r.role)).map((r) => r.user_id));
  const statusByBooking = bookingStatusMap(input.bookings);

  const bookingsByUser = new Map<string, CustomerBooking[]>();
  const ownerByBooking = new Map<string, string>();
  for (const b of input.bookings) {
    ownerByBooking.set(b.id, b.user_id);
    const list = bookingsByUser.get(b.user_id) ?? [];
    list.push(b);
    bookingsByUser.set(b.user_id, list);
  }

  const paidByUser = new Map<string, number>();
  for (const p of input.payments) {
    if (!isRevenuePayment(p, statusByBooking)) continue;
    const owner = ownerByBooking.get(p.booking_id);
    if (!owner) continue;
    paidByUser.set(owner, (paidByUser.get(owner) ?? 0) + Number(p.amount ?? 0));
  }

  return input.profiles
    .filter((p) => !staff.has(p.id))
    .map((profile) => {
      const bookings = [...(bookingsByUser.get(profile.id) ?? [])].sort(
        (a, b) => time(b.created_at) - time(a.created_at),
      );
      return {
        profile,
        bookings,
        bookingCount: bookings.length,
        totalPaid: paidByUser.get(profile.id) ?? 0,
      };
    })
    .sort((a, b) => time(b.profile.created_at) - time(a.profile.created_at));
}

/** Search by name (case-insensitive) or phone (digits only, so dashes and spaces are ignored). */
export function filterCustomers(rows: CustomerRow[], query: string): CustomerRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const digits = q.replace(/\D/g, "");
  return rows.filter((r) => {
    if ((r.profile.full_name ?? "").toLowerCase().includes(q)) return true;
    return digits.length > 0 && (r.profile.phone ?? "").replace(/\D/g, "").includes(digits);
  });
}

/** Hide every letter/digit except the last 4, keeping separators such as dashes. */
export function maskId(value: string | null | undefined): string {
  if (!value) return "-";
  const total = (value.match(/[\p{L}\p{N}]/gu) ?? []).length;
  let seen = 0;
  return value.replace(/[\p{L}\p{N}]/gu, (ch) => (++seen <= total - 4 ? "x" : ch));
}
