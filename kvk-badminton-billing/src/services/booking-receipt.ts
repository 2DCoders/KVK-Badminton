import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

export type ReceiptSlot = {
  bookingNumber: string;
  courtName: string;
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  bookingAmount: number;
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Colombo", day: "numeric", month: "short", year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Colombo", hour: "numeric", minute: "2-digit",
});
const amountFormat = new Intl.NumberFormat("en-LK", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export function createBookingReceipt(customer: string, payment: string, slots: ReceiptSlot[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const right = width - 48;
  const red = "#a6141f";
  const ink = "#1e293b";
  const muted = "#546070";
  const slotsByTime = [...slots].sort((a, b) =>
    a.slotDate.localeCompare(b.slotDate) ||
    a.slotStartTime.localeCompare(b.slotStartTime) ||
    a.courtName.localeCompare(b.courtName));
  const references = [...new Set(slotsByTime.map(slot => slot.bookingNumber))];
  const issued = new Date();

  function text(value: string, x: number, y: number, size: number, color = ink, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(value, x, y);
  }

  doc.setProperties({ title: "KVK Arena Badminton Booking Receipt" });
  doc.setFillColor(red).rect(48, 85, 32, 4, "F");
  text("KVK ARENA / BADMINTON", 48, 112, 12, red, true);
  text("Booking receipt", 48, 150, 29, ink, true);
  doc.setFillColor("#e3f2e8").rect(right - 69, 131, 69, 24, "F");
  text("PAID", right - 48, 147, 10, "#1c5733", true);
  doc.setDrawColor("#d9dee5").line(48, 174, right, 174);

  function field(title: string, value: string, x: number, y: number) {
    text(title, x, y, 9, muted, true);
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(ink);
    const lines: string[] = doc.splitTextToSize(value, 226);
    doc.text(lines, x, y + 18);
    return y + 18 + lines.length * 14;
  }

  field("ISSUED", `${dateFormat.format(issued)}, ${timeFormat.format(issued)}`, 315, 204);
  const referencesEnd = field("BOOKING REFERENCE", references[0] ?? "", 48, 204);
  field("PAYMENT METHOD", payment, 315, referencesEnd + 20);
  const customerEnd = field("CUSTOMER", customer, 48, referencesEnd + 20);
  text("Booked court times", 48, customerEnd + 30, 15, ink, true);

  autoTable(doc, {
    startY: customerEnd + 52,
    margin: { left: 48, right: 48, bottom: 65 },
    head: [["Date", "Court", "Time", ...(references.length > 1 ? ["Reference"] : []), "Amount (LKR)"]],
    body: slotsByTime.map(slot => {
      const date = slot.slotDate.slice(0, 10);
      const time = (value: string) => timeFormat.format(new Date(`${date}T${value}+05:30`));
      return [
        dateFormat.format(new Date(`${date}T00:00:00+05:30`)),
        slot.courtName,
        `${time(slot.slotStartTime)} - ${time(slot.slotEndTime)}`,
        ...(references.length > 1 ? [slot.bookingNumber] : []),
        amountFormat.format(slot.bookingAmount),
      ];
    }),
    foot: [[
      { content: "Total paid", colSpan: references.length > 1 ? 4 : 3 },
      { content: `LKR ${amountFormat.format(slots.reduce((sum, slot) => sum + slot.bookingAmount, 0))}`, styles: { halign: "right" } },
    ]],
    showFoot: "lastPage",
    theme: "plain",
    rowPageBreak: "avoid",
    styles: { fontSize: 10, cellPadding: 9, textColor: ink },
    headStyles: { fillColor: "#eff1f3", fontStyle: "bold" },
    bodyStyles: { lineColor: "#d9dee5", lineWidth: { bottom: 0.5 } },
    footStyles: { fillColor: "#faeeee", textColor: red, fontStyle: "bold", fontSize: 12 },
    columnStyles: { [references.length > 1 ? 4 : 3]: { halign: "right" } },
  });

  text("Please keep this receipt for your records.", 48, doc.internal.pageSize.getHeight() - 36, 10, muted);
  return { doc, filename: `badminton-receipt-${references[0]}.pdf` };
}
