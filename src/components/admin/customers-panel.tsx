import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { filterCustomers, maskId, NO_NAME, type CustomerRow } from "@/lib/customers";
import { bookingStatusLabel, fmtDate, thb } from "@/lib/format";

const nameOf = (row: CustomerRow) => row.profile.full_name?.trim() || NO_NAME;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium break-words">{value}</div>
    </div>
  );
}

/** Admin tab: look up customers and their rental history. View only. */
export function AdminCustomersPanel({ rows }: { rows: CustomerRow[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [showIds, setShowIds] = useState(false);

  const filtered = useMemo(() => filterCustomers(rows, search), [rows, search]);

  const close = () => {
    setSelected(null);
    setShowIds(false);
  };

  const idValue = (v: string | null) => (showIds ? v || "-" : maskId(v));

  return (
    <Card className="shadow-card">
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle>ข้อมูลลูกค้า ({filtered.length})</CardTitle>
          <CardDescription>ดูข้อมูลและประวัติการเช่าของลูกค้า (ดูอย่างเดียว)</CardDescription>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ หรือเบอร์โทร..."
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ</TableHead>
              <TableHead>เบอร์โทร</TableHead>
              <TableHead className="text-right">การจอง</TableHead>
              <TableHead className="text-right">ชำระแล้ว</TableHead>
              <TableHead>สมัครเมื่อ</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  ไม่พบลูกค้า
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.profile.id}>
                  <TableCell className="font-medium">{nameOf(row)}</TableCell>
                  <TableCell>{row.profile.phone || "-"}</TableCell>
                  <TableCell className="text-right">{row.bookingCount}</TableCell>
                  <TableCell className="text-right">{thb(row.totalPaid)}</TableCell>
                  <TableCell>{fmtDate(row.profile.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                      ดู
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{nameOf(selected)}</DialogTitle>
                <DialogDescription>
                  สมัครเมื่อ {fmtDate(selected.profile.created_at)} · จอง {selected.bookingCount}{" "}
                  ครั้ง · ชำระแล้ว {thb(selected.totalPaid)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="เบอร์โทร" value={selected.profile.phone || "-"} />
                <Field label="ที่อยู่" value={selected.profile.address || "-"} />
                <Field label="เลขใบขับขี่" value={idValue(selected.profile.license_no)} />
                <Field label="เลขบัตรประชาชน" value={idValue(selected.profile.id_card_no)} />
              </div>
              <div>
                <Button size="sm" variant="ghost" onClick={() => setShowIds((v) => !v)}>
                  {showIds ? "ซ่อน" : "แสดง"}
                </Button>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">ประวัติการจอง</h3>
                {selected.bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ยังไม่มีการจอง</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>รหัสการจอง</TableHead>
                          <TableHead>รถ</TableHead>
                          <TableHead>วันที่เช่า</TableHead>
                          <TableHead className="text-right">ยอด</TableHead>
                          <TableHead>สถานะ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selected.bookings.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="font-mono text-xs">{b.booking_code}</TableCell>
                            <TableCell>
                              {b.cars
                                ? `${b.cars.brand} ${b.cars.model} (${b.cars.plate_no})`
                                : "-"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {fmtDate(b.start_date)} – {fmtDate(b.end_date)}
                            </TableCell>
                            <TableCell className="text-right">{thb(b.total_amount)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {bookingStatusLabel[b.status] ?? b.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
