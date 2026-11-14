import { describe, expect, it } from "vitest";
import {
  buildCustomerRows,
  filterCustomers,
  maskId,
  type CustomerBooking,
  type CustomerProfile,
} from "@/lib/customers";

const profile = (id: string, extra: Partial<CustomerProfile> = {}): CustomerProfile => ({
  id,
  full_name: `ลูกค้า ${id}`,
  phone: null,
  address: null,
  license_no: null,
  id_card_no: null,
  created_at: "2026-01-01T00:00:00Z",
  ...extra,
});

const booking = (
  id: string,
  user_id: string,
  extra: Partial<CustomerBooking> = {},
): CustomerBooking => ({
  id,
  user_id,
  booking_code: `BK-${id}`,
  status: "confirmed",
  start_date: "2026-03-01",
  end_date: "2026-03-03",
  total_amount: 1000,
  created_at: "2026-02-01T00:00:00Z",
  cars: { brand: "Toyota", model: "Yaris", plate_no: "กข 1234" },
  ...extra,
});

describe("buildCustomerRows", () => {
  it("excludes admin and demo_admin users", () => {
    const rows = buildCustomerRows({
      profiles: [profile("c1"), profile("a1"), profile("d1")],
      bookings: [],
      payments: [],
      roles: [
        { user_id: "a1", role: "admin" },
        { user_id: "d1", role: "demo_admin" },
        { user_id: "c1", role: "customer" },
      ],
    });
    expect(rows.map((r) => r.profile.id)).toEqual(["c1"]);
  });

  it("keeps a profile with no role row", () => {
    const rows = buildCustomerRows({
      profiles: [profile("c2")],
      bookings: [],
      payments: [],
      roles: [],
    });
    expect(rows.map((r) => r.profile.id)).toEqual(["c2"]);
  });

  it("sorts newest sign-up first, missing created_at last", () => {
    const rows = buildCustomerRows({
      profiles: [
        profile("jan", { created_at: "2026-01-01T00:00:00Z" }),
        profile("missing", { created_at: null }),
        profile("jun", { created_at: "2026-06-01T00:00:00Z" }),
      ],
      bookings: [],
      payments: [],
      roles: [],
    });
    expect(rows.map((r) => r.profile.id)).toEqual(["jun", "jan", "missing"]);
  });

  it("counts bookings and sorts them newest first", () => {
    const rows = buildCustomerRows({
      profiles: [profile("c1")],
      bookings: [
        booking("old", "c1", { created_at: "2026-02-01T00:00:00Z" }),
        booking("new", "c1", { created_at: "2026-05-01T00:00:00Z" }),
        booking("other", "c9"),
      ],
      payments: [],
      roles: [],
    });
    expect(rows[0]?.bookingCount).toBe(2);
    expect(rows[0]?.bookings[0]?.id).toBe("new");
  });

  it("totalPaid counts only revenue payments", () => {
    const rows = buildCustomerRows({
      profiles: [profile("c1")],
      bookings: [
        booking("b1", "c1", { status: "completed" }),
        booking("b2", "c1", { status: "cancelled" }),
        booking("b3", "c1", { status: "confirmed" }),
      ],
      payments: [
        { booking_id: "b1", amount: "1500", status: "paid", paid_at: "2026-02-01T00:00:00Z" },
        { booking_id: "b2", amount: 900, status: "paid", paid_at: "2026-02-01T00:00:00Z" },
        { booking_id: "b3", amount: 500, status: "pending", paid_at: "2026-02-01T00:00:00Z" },
      ],
      roles: [],
    });
    expect(rows[0]?.totalPaid).toBe(1500);
  });

  it("customer without bookings has zero totals", () => {
    const rows = buildCustomerRows({
      profiles: [profile("c1")],
      bookings: [],
      payments: [],
      roles: [],
    });
    expect(rows[0]).toMatchObject({ bookingCount: 0, totalPaid: 0, bookings: [] });
  });
});

describe("filterCustomers", () => {
  const rows = buildCustomerRows({
    profiles: [
      profile("s", { full_name: "สมชาย ใจดี", phone: "0812345678" }),
      profile("j", { full_name: "John Doe", phone: "0899999990" }),
    ],
    bookings: [],
    payments: [],
    roles: [],
  });
  const ids = (q: string) =>
    filterCustomers(rows, q)
      .map((r) => r.profile.id)
      .sort();

  it("empty or blank query returns all rows", () => {
    expect(ids("")).toEqual(["j", "s"]);
    expect(ids("   ")).toEqual(["j", "s"]);
  });

  it("matches name case-insensitively and Thai substrings", () => {
    expect(ids("สมชาย")).toEqual(["s"]);
    expect(ids("JOHN")).toEqual(["j"]);
  });

  it("matches phone ignoring dashes and spaces", () => {
    expect(ids("081-234")).toEqual(["s"]);
    expect(ids("081 234")).toEqual(["s"]);
    expect(ids("777")).toEqual([]);
  });
});

describe("maskId", () => {
  it("keeps the last 4 characters", () => {
    expect(maskId("1-2345-67890-12-3")).toBe("x-xxxx-xxxx0-12-3");
    expect(maskId("AB123456")).toBe("xxxx3456");
    expect(maskId("")).toBe("-");
    expect(maskId(null)).toBe("-");
    expect(maskId("123")).toBe("123");
  });
});
