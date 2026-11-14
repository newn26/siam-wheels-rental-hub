import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { AdminCustomersPanel } from "@/components/admin/customers-panel";
import { buildCustomerRows, maskId } from "@/lib/customers";
import { bookingStatusLabel, thb } from "@/lib/format";

const ID_CARD = "1-2345-67890-12-3";

function rows() {
  return buildCustomerRows({
    profiles: [
      {
        id: "c1",
        full_name: "สมชาย ใจดี",
        phone: "0812345678",
        address: "99 ถนนทดสอบ กรุงเทพ",
        license_no: "DL12345678",
        id_card_no: ID_CARD,
        created_at: "2026-06-01T00:00:00Z",
      },
      {
        id: "c2",
        full_name: "",
        phone: "0890000000",
        address: null,
        license_no: null,
        id_card_no: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    bookings: [
      {
        id: "b1",
        user_id: "c1",
        booking_code: "BK-TEST-01",
        status: "completed",
        start_date: "2026-03-01",
        end_date: "2026-03-03",
        total_amount: 1500,
        created_at: "2026-02-01T00:00:00Z",
        cars: { brand: "Toyota", model: "Yaris", plate_no: "กข 1234" },
      },
      {
        id: "b2",
        user_id: "c1",
        booking_code: "BK-TEST-02",
        status: "cancelled",
        start_date: "2026-04-01",
        end_date: "2026-04-02",
        total_amount: 900,
        created_at: "2026-03-15T00:00:00Z",
        cars: null,
      },
    ],
    payments: [{ booking_id: "b1", amount: 1500, status: "paid", paid_at: "2026-02-01T00:00:00Z" }],
    roles: [],
  });
}

const rowOf = (text: string) => screen.getByText(text).closest("tr") as HTMLElement;

describe("AdminCustomersPanel", () => {
  it("lists customers with count, total and heading", () => {
    render(<AdminCustomersPanel rows={rows()} />);
    expect(screen.getByText("ข้อมูลลูกค้า (2)")).toBeInTheDocument();
    const row = within(rowOf("สมชาย ใจดี"));
    expect(row.getByText("0812345678")).toBeInTheDocument();
    expect(row.getByText("2")).toBeInTheDocument();
    expect(row.getByText(thb(1500))).toBeInTheDocument();
  });

  it("shows placeholder for a missing name", () => {
    render(<AdminCustomersPanel rows={rows()} />);
    expect(screen.getByText("(ไม่ระบุชื่อ)")).toBeInTheDocument();
  });

  it("search filters rows", () => {
    render(<AdminCustomersPanel rows={rows()} />);
    const input = screen.getByPlaceholderText("ค้นหาชื่อ หรือเบอร์โทร...");
    fireEvent.change(input, { target: { value: "081-234" } });
    expect(screen.getByText("สมชาย ใจดี")).toBeInTheDocument();
    expect(screen.queryByText("(ไม่ระบุชื่อ)")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText("ไม่พบลูกค้า")).toBeInTheDocument();
  });

  it("detail dialog shows masked ids and booking history", async () => {
    render(<AdminCustomersPanel rows={rows()} />);
    fireEvent.click(within(rowOf("สมชาย ใจดี")).getByRole("button", { name: "ดู" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("99 ถนนทดสอบ กรุงเทพ")).toBeInTheDocument();
    expect(dialog.getByText(maskId(ID_CARD))).toBeInTheDocument();
    expect(dialog.queryByText(ID_CARD)).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "แสดง" }));
    expect(dialog.getByText(ID_CARD)).toBeInTheDocument();
    expect(dialog.getByText("BK-TEST-01")).toBeInTheDocument();
    expect(dialog.getByText(bookingStatusLabel["completed"] ?? "")).toBeInTheDocument();
    const noCarRow = within(dialog.getByText("BK-TEST-02").closest("tr") as HTMLElement);
    expect(noCarRow.getByText("-")).toBeInTheDocument();
  });

  it("detail dialog for customer without bookings", async () => {
    render(<AdminCustomersPanel rows={rows()} />);
    fireEvent.click(within(rowOf("(ไม่ระบุชื่อ)")).getByRole("button", { name: "ดู" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("ยังไม่มีการจอง")).toBeInTheDocument();
  });
});
