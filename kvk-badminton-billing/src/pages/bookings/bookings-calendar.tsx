import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { getBookingsList } from "@/services/booking-api";

type CalendarBooking = {
  id: string;
  bookingNumber: string;
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  courtName: string;
  customerName: string;
};

type MonthResult = { key: string; bookings: CalendarBooking[]; error?: boolean };

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const confirmedStatus = 2;
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "full" });
const buttonStyle = "inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-600";

function dateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

async function loadMonth(fromDate: string, toDate: string, signal: AbortSignal) {
  const bookings: CalendarBooking[] = [];
  const seen = new Set<string>();
  for (let pageNumber = 1; ; pageNumber++) {
    const rows: CalendarBooking[] = await getBookingsList(
      { fromDate, toDate, status: confirmedStatus, pageNumber, pageSize: 100 },
      signal,
    );

    if (!Array.isArray(rows)) throw new Error("Unexpected booking response");
    if (rows.length === 0) break;

    const previousCount = seen.size;
    for (const booking of rows) {
      if (seen.has(booking.id)) continue;
      seen.add(booking.id);
      bookings.push(booking);
    }
    if (seen.size === previousCount) throw new Error("Booking pagination did not advance");
  }
  return bookings.sort((a, b) => a.slotStartTime.localeCompare(b.slotStartTime));
}

export default function BookingsCalendar({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<MonthResult>();
  const detailsHeading = useRef<HTMLHeadingElement>(null);
  const dayTrigger = useRef<HTMLButtonElement>(null);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const lastDay = new Date(year, monthIndex + 1, 0);
  const fromDate = dateKey(month);
  const toDate = dateKey(lastDay);
  const requestKey = `${fromDate}/${attempt}`;
  const visibleResult = result?.key === requestKey ? result : undefined;
  const monthLabel = monthFormat.format(month);
  const firstOffset = (month.getDay() + 6) % 7;
  const dayCount = lastDay.getDate();
  const cellCount = Math.ceil((firstOffset + dayCount) / 7) * 7;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    if (selectedDay) detailsHeading.current?.focus();
  }, [selectedDay]);

  useEffect(() => {
    const controller = new AbortController();
    void loadMonth(fromDate, toDate, controller.signal).then(
      (bookings) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, bookings });
      },
      () => {
        if (!controller.signal.aborted) setResult({ key: requestKey, bookings: [], error: true });
      },
    );
    return () => controller.abort();
  }, [fromDate, toDate, requestKey]);

  const byDate = new Map<string, CalendarBooking[]>();
  for (const booking of visibleResult?.bookings ?? []) {
    const key = booking.slotDate.slice(0, 10);
    const dayBookings = byDate.get(key) ?? [];
    dayBookings.push(booking);
    byDate.set(key, dayBookings);
  }

  function navigateMonth(offset: number) {
    setSelectedDay(null);
    setMonth(new Date(year, monthIndex + offset, 1));
    setAttempt((value) => value + 1);
  }

  function closeCalendar() {
    dialog.current?.close();
    onClose();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="bookings-calendar-title"
      onCancel={(event) => { event.preventDefault(); closeCalendar(); }}
      className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%_-_1rem)] max-w-6xl overflow-hidden rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/65 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[92dvh] flex-col">
        <header className="flex items-center justify-between gap-3 bg-slate-900 px-4 py-4 text-white sm:px-6">
          <div className="flex items-center gap-3">
            <CalendarDays size={23} className="text-amber-300" aria-hidden="true" />
            <h2 id="bookings-calendar-title" className="text-lg font-semibold sm:text-xl">Bookings Calendar</h2>
          </div>
          <button type="button" aria-label="Close calendar" onClick={closeCalendar} className="cursor-pointer rounded-lg p-2 text-slate-200 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-amber-300">
            <X size={22} />
          </button>
        </header>

        <div className="overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold tracking-tight sm:text-2xl" aria-live="polite">{monthLabel}</h3>
              <p className="mt-1 text-sm text-slate-600" role="status">
                {!visibleResult ? "Loading bookings…" : visibleResult.error ? "" : `${visibleResult.bookings.length} confirmed slots`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className={buttonStyle} aria-label="Previous month" onClick={() => navigateMonth(-1)}><ChevronLeft size={18} /></button>
              <button type="button" className={`${buttonStyle} text-sm font-medium`} onClick={() => {
                setSelectedDay(null);
                setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                setAttempt((value) => value + 1);
              }}>Today</button>
              <button type="button" className={buttonStyle} aria-label="Next month" onClick={() => navigateMonth(1)}><ChevronRight size={18} /></button>
            </div>
          </div>

          {visibleResult?.error && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              <p role="alert">Unable to load bookings for this month.</p>
              <button type="button" className={buttonStyle} onClick={() => setAttempt((value) => value + 1)}>Retry</button>
            </div>
          )}

          {selectedDay && (
            <section aria-labelledby="booking-day-heading" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h4 ref={detailsHeading} id="booking-day-heading" tabIndex={-1} className="font-semibold">{dayFormat.format(selectedDay)}</h4>
                <button type="button" className={`${buttonStyle} gap-2 text-sm`} onClick={() => {
                  setSelectedDay(null);
                  dayTrigger.current?.focus();
                }}><ArrowLeft size={16} /> Back to calendar</button>
              </div>
              <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {byDate.get(dateKey(selectedDay))?.map((booking) => (
                  <li key={booking.id} className="grid gap-1 px-3 py-2.5 text-sm sm:grid-cols-3 sm:gap-4">
                    <span className="font-medium tabular-nums">{booking.slotStartTime.slice(0, 5)} – {booking.slotEndTime.slice(0, 5)} · {booking.courtName}</span>
                    <span>{booking.customerName}</span>
                    <span className="text-slate-600">{booking.bookingNumber}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[660px] table-fixed border-collapse text-left" aria-label={monthLabel} aria-busy={!visibleResult}>
              <thead className="bg-slate-100 text-xs font-semibold text-slate-600">
                <tr>{weekdayLabels.map((day) => <th key={day} scope="col" className="px-3 py-2.5">{day}</th>)}</tr>
              </thead>
              <tbody>
                {Array.from({ length: cellCount / 7 }, (_, week) => (
                  <tr key={week} className="divide-x divide-slate-200 border-t border-slate-200">
                    {Array.from({ length: 7 }, (_, column) => {
                      const day = week * 7 + column - firstOffset + 1;
                      if (day < 1 || day > dayCount) return <td key={column} className="bg-slate-50" />;
                      const date = new Date(year, monthIndex, day);
                      const key = dateKey(date);
                      const bookings = byDate.get(key) ?? [];
                      const isToday = key === dateKey(today);
                      const isSelected = selectedDay && dateKey(selectedDay) === key;
                      return (
                        <td key={column} className={`h-[108px] p-2 align-top ${isSelected ? "bg-amber-50" : "bg-white"}`}>
                          <time dateTime={key} aria-current={isToday ? "date" : undefined} className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-amber-300 text-slate-900" : "text-slate-700"}`}>{day}</time>
                          <ul className="mt-1 space-y-1">
                            {bookings.slice(0, 2).map((booking) => (
                              <li key={booking.id} className="truncate rounded border-l-2 border-amber-400 bg-amber-50 px-1.5 py-0.5 text-xs text-slate-800">
                                <span className="font-semibold tabular-nums">{booking.slotStartTime.slice(0, 5)}</span> {booking.courtName}
                              </li>
                            ))}
                          </ul>
                          {bookings.length > 0 && (
                            <button type="button" aria-label={`View ${bookings.length} bookings for ${dayFormat.format(date)}`} onClick={(event) => {
                              dayTrigger.current = event.currentTarget;
                              setSelectedDay(date);
                            }} className="mt-1 cursor-pointer rounded px-1 py-0.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-600">
                              {bookings.length > 2 ? `+${bookings.length - 2} more` : "Details"}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </dialog>
  );
}
