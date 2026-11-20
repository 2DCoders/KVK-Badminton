import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Clock3, Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getMemberBookingSetup, getCashierAvailability, bookingError, type BookingSetup, type CashierAvailability } from "@/services/special-bookings-api";
import { getEnv } from "@/env";
import { WEEKDAYS, endDate, isDate, maximumWeeks, slotTime, sriLankaToday } from "../booking-utils";

const formatDate = (date: string) => new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
}).format(new Date(`${date}T00:00:00Z`));
const statusLabels = { available: "Free", booked: "Booked", held: "On hold", past: "Already started" };
const statusStyles = {
  available: "border-green-200 bg-green-50 text-green-800",
  booked: "border-red-200 bg-red-50 text-red-800",
  held: "border-amber-200 bg-amber-50 text-amber-800",
  past: "border-gray-200 bg-gray-100 text-gray-600",
};
type Filter = "all" | "every-week" | "partial";

export default function SpecialBookingsAvailability() {
  const navigate = useNavigate();
  const env = getEnv();
  const today = sriLankaToday();
  const minDate = isDate(env.BADMINTON_BOOKING_START_DATE) && env.BADMINTON_BOOKING_START_DATE > today ? env.BADMINTON_BOOKING_START_DATE : today;
  const configuredWeeks = maximumWeeks(env.BOOKING_DURATION) || 12;
  const [setup, setSetup] = useState<BookingSetup | null>(null);
  const [setupError, setSetupError] = useState("");
  const [setupReload, setSetupReload] = useState(0);
  const [startDate, setStartDate] = useState(minDate);
  const [weeks, setWeeks] = useState(1);
  const [day, setDay] = useState("Monday");
  const [filter, setFilter] = useState<Filter>("all");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ key: string; data: CashierAvailability } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const maxWeeks = Math.min(12, setup?.maximumWeeks ?? 12, configuredWeeks);
  const valid = isDate(startDate) && startDate >= minDate && weeks >= 1 && weeks <= maxWeeks;
  const queryKey = `${setup?.court.id}/${startDate}/${weeks}/${day}/${reload}`;
  const data = result?.key === queryKey ? result.data : null;
  const currentError = error?.key === queryKey ? error.message : "";
  const checking = !!setup && valid && !data && !currentError;
  const allWeekCount = data?.slots.filter(slot => slot.availableEveryWeek).length ?? 0;
  const partialCount = data?.slots.filter(slot => slot.availableCount > 0 && !slot.availableEveryWeek).length ?? 0;
  const unavailableCount = data?.slots.filter(slot => slot.availableCount === 0).length ?? 0;
  const visibleSlots = data?.slots.filter(slot => filter === "all" || (filter === "every-week" ? slot.availableEveryWeek : slot.availableCount > 0 && !slot.availableEveryWeek)) ?? [];

  useEffect(() => {
    const controller = new AbortController();
    getMemberBookingSetup(controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setSetup(value); setSetupError("");
      setWeeks(current => Math.min(current, 12, value.maximumWeeks, configuredWeeks));
    }).catch(reason => { if (!controller.signal.aborted) setSetupError(bookingError(reason)); });
    return () => controller.abort();
  }, [configuredWeeks, setupReload]);

  useEffect(() => {
    if (!setup || !valid) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const value = await getCashierAvailability({ startDate, weeks, daysOfWeek: [day] }, controller.signal);
        if (!Array.isArray(value?.dates) || !Array.isArray(value?.slots)) throw new Error("Availability could not be loaded. Please try again.");
        if (!controller.signal.aborted) { setResult({ key: queryKey, data: value }); setError(null); }
      } catch (reason) {
        if (!controller.signal.aborted) setError({ key: queryKey, message: bookingError(reason) });
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [setup, valid, startDate, weeks, day, queryKey]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Special Booking Availability</h1>
          <p className="mt-1 text-sm text-gray-500">Find a time that is free every week for your recurring booking.</p>
        </div>
        <button type="button" onClick={() => navigate("/special-bookings")} className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"><ArrowLeft size={16} /> Back to Special Bookings</button>
      </div>

      {setupError ? <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{setupError}<button type="button" onClick={() => { setSetupError(""); setSetupReload(value => value + 1); }} className="ml-3 underline">Try again</button></div> : !setup && <p role="status" className="mb-6 flex items-center gap-2 text-sm text-gray-600"><Loader2 size={16} className="animate-spin" /> Loading court...</p>}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="Availability options">
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <CalendarDays size={22} className="text-amber-700" />
          <div><p className="font-semibold text-amber-800">{setup?.court.name ?? "Badminton court"}</p><p className="mt-1 text-xs text-amber-700">Choose the first date, duration, and weekly booking day.</p></div>
        </div>
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="availability-start" className="mb-2 block text-sm font-medium text-gray-700">Starting date</label><input id="availability-start" type="date" min={minDate} value={startDate} onChange={event => setStartDate(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500" /></div>
          <div><label htmlFor="availability-duration" className="mb-2 block text-sm font-medium text-gray-700">Duration</label><select id="availability-duration" value={weeks} onChange={event => setWeeks(Number(event.target.value))} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500">{Array.from({ length: maxWeeks }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value} {value === 1 ? "week" : "weeks"}</option>)}</select></div>
        </div>
        <fieldset className="min-w-0 border-0 p-0">
          <legend className="mb-3 text-sm font-medium text-gray-700">Repeat every</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{WEEKDAYS.map(value => <button key={value} type="button" aria-pressed={day === value} onClick={() => setDay(value)} className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium ${day === value ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>{day === value && <Check size={14} />}{value}</button>)}</div>
        </fieldset>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
          <p>{valid ? <>Every <strong className="text-gray-800">{day}</strong>, from {formatDate(startDate)} to {formatDate(endDate(startDate, weeks))}.</> : `Choose a valid start date on or after ${formatDate(minDate)}.`}</p>
          <button type="button" disabled={!setup || !valid || checking || loading} onClick={() => setReload(value => value + 1)} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 disabled:opacity-50"><RefreshCw size={14} /> Refresh</button>
        </div>
      </section>

      {checking && <div role="status" className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-10 text-sm text-gray-600"><Loader2 size={18} className="animate-spin" /> Checking every {day} in your booking period...</div>}
      {currentError && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{currentError}<button type="button" onClick={() => setReload(value => value + 1)} className="ml-3 underline">Try again</button></div>}

      {data && <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="Availability results">
        <div className="mb-5"><h2 className="text-lg font-semibold text-gray-900">Which times work for all {data.dates.length} {data.dates.length === 1 ? "session" : "sessions"}?</h2><p className="mt-1 text-sm text-gray-500">?Free every week? means this time is available on every selected {day}. Expand a time to see each date.</p></div>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4"><strong className="text-xl text-green-800">{allWeekCount}</strong><p className="mt-1 text-sm text-green-800">Free every week</p></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><strong className="text-xl text-amber-800">{partialCount}</strong><p className="mt-1 text-sm text-amber-800">Partly available</p></div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><strong className="text-xl text-gray-700">{unavailableCount}</strong><p className="mt-1 text-sm text-gray-600">No free dates</p></div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2" aria-label="Filter times">{([{ value: "all", label: "All times" }, { value: "every-week", label: "Free every week" }, { value: "partial", label: "Partly available" }] as const).map(item => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${filter === item.value ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600"}`}>{item.label}</button>)}</div>
        {visibleSlots.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-600">{data.slots.length === 0 ? "No active time slots are configured for this court." : filter === "every-week" ? "No time is free for every week. Try a different day, start date, or shorter duration." : filter === "partial" ? "No partly available times. Check All times to see the full schedule." : "No available times. Try a different booking period."}</p> :
          <div className="space-y-3">{visibleSlots.map(slot => <details key={slot.slotId} className="rounded-xl border border-gray-200 bg-white">
            <summary className="cursor-pointer p-4 marker:text-gray-400"><span className="ml-1 inline-flex flex-wrap items-center gap-x-5 gap-y-2 align-middle"><span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900"><Clock3 size={16} className="text-gray-500" />{slotTime(slot.startTime)} ? {slotTime(slot.endTime)}</span><span className={`rounded-full px-3 py-1 text-xs font-medium ${slot.availableEveryWeek ? "bg-green-50 text-green-800" : slot.availableCount > 0 ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-600"}`}>{slot.availableEveryWeek ? "Free every week" : slot.availableCount > 0 ? "Partly available" : "Unavailable"}</span><span className="text-xs text-gray-500">{slot.availableCount} of {slot.totalCount} dates free ? View dates</span></span></summary>
            <div className="grid gap-2 border-t border-gray-100 p-4 sm:grid-cols-2 lg:grid-cols-3">{slot.sessions.map(session => <div key={session.date} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-xs ${statusStyles[session.status]}`}><span>{formatDate(session.date)}</span><strong className="font-medium">{statusLabels[session.status]}</strong></div>)}</div>
          </details>)}</div>}
        <p className="mt-5 text-xs leading-5 text-gray-500">On hold means another booking is being completed. Availability can change; sessions are reserved only when you select Reserve sessions in Special Bookings.</p>
      </section>}
    </div>
  );
}
