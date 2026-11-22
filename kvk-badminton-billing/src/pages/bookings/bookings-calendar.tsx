import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { getBookingsList } from "@/services/booking-api";

type CalendarBooking = {
  id: string;
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  courtName: string;
  customerName: string;
  phoneNumber?: string | null;
};

type MonthResult = { key: string; bookings: CalendarBooking[]; error?: boolean };

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const confirmedStatus = 2;
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "full" });
const buttonStyle = "inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-600";
const calendarActionStyle = "group inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-sm leading-none font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
const actionIconStyle = "inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors";
const detailCellStyle = "border-b border-slate-200 px-4 py-4 align-middle leading-6";

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
  const dayBookings = selectedDay ? byDate.get(dateKey(selectedDay)) ?? [] : [];

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
      className="fixed inset-0 m-auto h-dvh max-h-none w-full max-w-none border-0 bg-white p-0 text-slate-900 backdrop:bg-slate-950/60 sm:h-[calc(100dvh_-_2rem)] sm:w-[calc(100%_-_2rem)] sm:max-w-screen-2xl sm:rounded-2xl sm:shadow-2xl"
      style={{ overflowY: "auto", overflowX: "hidden" }}
    >
      <div className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 bg-slate-900 px-4 py-4 text-white sm:px-6">
          <div className="flex items-center gap-3">
            <CalendarDays size={23} className="text-amber-300" aria-hidden="true" />
            <h2 id="bookings-calendar-title" className="text-lg font-semibold sm:text-xl">Bookings Calendar</h2>
          </div>
          <button type="button" aria-label="Close calendar" onClick={closeCalendar} className="cursor-pointer rounded-lg p-2 text-slate-200 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-amber-300">
            <X size={22} />
          </button>
        </header>

        <div className="flex flex-1 flex-col px-3 py-4 sm:px-6 sm:py-5">
          <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold tracking-tight sm:text-2xl" aria-live="polite">{monthLabel}</h3>
              <p className="mt-1 text-sm text-slate-600" role="status">
                {!visibleResult ? "Loading bookings…" : visibleResult.error ? "" : `${visibleResult.bookings.length} confirmed slots`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className={buttonStyle} aria-label="Previous month" onClick={() => navigateMonth(-1)}><ChevronLeft size={18} /></button>
              <button type="button" className={`${calendarActionStyle} border-slate-700 bg-slate-900 text-white shadow-md shadow-slate-900/20 hover:bg-slate-800`} onClick={() => {
                setSelectedDay(null);
                setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                setAttempt((value) => value + 1);
              }}>
                <span className={`${actionIconStyle} bg-amber-300 text-slate-950 group-hover:bg-amber-200`}>
                  <CalendarDays size={16} className="block shrink-0" aria-hidden="true" />
                </span>
                <span>Today</span>
              </button>
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
            <section aria-labelledby="booking-day-heading" className="mb-5 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-amber-400 bg-slate-900 px-4 py-4 text-white sm:px-6">
                <div>
                  <h4 ref={detailsHeading} id="booking-day-heading" tabIndex={-1} className="text-lg font-semibold tracking-tight sm:text-xl">{dayFormat.format(selectedDay)}</h4>
                  <p className="mt-1 text-sm text-slate-300">{dayBookings.length} confirmed {dayBookings.length === 1 ? "slot" : "slots"}</p>
                </div>
                <button type="button" className={`${calendarActionStyle} border-white/25 bg-white/10 text-white hover:bg-white/20`} onClick={() => {
                  setSelectedDay(null);
                  dayTrigger.current?.focus();
                }}>
                  <span className={`${actionIconStyle} bg-white/10 text-amber-300 group-hover:bg-white/20`}>
                    <ArrowLeft size={16} className="block shrink-0" aria-hidden="true" />
                  </span>
                  <span>Back to calendar</span>
                </button>
              </div>
              <div className="max-h-[40dvh] overflow-auto">
                <table aria-labelledby="booking-day-heading" className="w-full min-w-[440px] border-separate border-spacing-0 text-left text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-xs font-semibold text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-3 sm:px-6">Time</th>
                      <th scope="col" className="px-4 py-3">Court</th>
                      <th scope="col" className="px-4 py-3">Customer</th>
                      <th scope="col" className="px-4 py-3 sm:px-6">Phone number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayBookings.map((booking) => (
                      <tr key={booking.id} className="odd:bg-white even:bg-slate-50">
                        <td className={`${detailCellStyle} whitespace-nowrap font-semibold tabular-nums sm:px-6`}>{booking.slotStartTime.slice(0, 5)} – {booking.slotEndTime.slice(0, 5)}</td>
                        <td className={`${detailCellStyle} text-slate-700`}>{booking.courtName}</td>
                        <td className={`${detailCellStyle} font-medium`}>{booking.customerName}</td>
                        <td className={`${detailCellStyle} whitespace-nowrap text-slate-700 tabular-nums sm:px-6`}>{booking.phoneNumber?.trim() || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="flex grow shrink-0 overflow-x-auto rounded-xl border border-slate-200">
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
