import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  ChevronDown,
  Clock,
  Eye,
  Hash,
  MapPin,
  Phone,
  PlayCircle,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { getBookingsList, payWalkIn, WALK_IN_PENDING_PAYMENT } from "@/services/booking-api";
import { getCourts } from "@/services/courts-api";
import { bookingError } from "@/services/special-bookings-api";
import { sriLankaToday } from "../bookings/special-bookings/booking-utils";

/* =========================================================
   Types
   ========================================================= */

type BookingRow = {
  id: string;
  bookingNumber: string;
  courtId: string;
  courtName: string;
  courtSlotId: string;
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  customerName: string;
  phoneNumber: string;
  bookingAmount: number;
  status: number;
  createdAt: string;
  paymentType: number;
  notes?: string | null;
  walkInId?: string | null;
};

type CourtOption = {
  id: string;
  name: string;
};

type ScheduleStatus = "upcoming" | "ongoing" | "completed";

const CONFIRMED_STATUS = 2;
const isPendingWalkIn = (booking: BookingRow) => booking.status === WALK_IN_PENDING_PAYMENT;

/* =========================================================
   Today's Schedule Page
   ========================================================= */

export default function Today() {
  const navigate = useNavigate();

  const dayendData = localStorage.getItem("dayEndData")
    ? JSON.parse(localStorage.getItem("dayEndData") as string)
    : null;

  useEffect(() => {
    if (!dayendData) {
      navigate("/dayend");
    }
  }, [dayendData, navigate]);

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [now, setNow] = useState(new Date());
  const todayDate = sriLankaToday(now);
  const [paymentNotice, setPaymentNotice] = useState("");

  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState("");

  const [viewingBooking, setViewingBooking] = useState<BookingRow | null>(
    null,
  );

  /* Keep "ongoing/upcoming" status ticking without refetching data */
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const formatDateDisplay = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-GB", {
        timeZone: "Asia/Colombo",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const parsed = new Date();
    parsed.setHours(Number(hours), Number(minutes), 0, 0);

    return parsed.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const paymentLabel = (paymentType: number) =>
    paymentType === 3 ? "Bank transfer" : paymentType === 2 ? "Card" : "Cash";

  /* =========================================================
     Court Filter Options
     ========================================================= */

  const loadCourts = async () => {
    try {
      const response = await getCourts();
      const rows: CourtOption[] = Array.isArray(response)
        ? response.map((court: any) => ({ id: court.id, name: court.name }))
        : [];
      setCourts(rows);
    } catch (error) {
      console.error("Failed to load courts:", error);
      setCourts([]);
    }
  };

  useEffect(() => {
    void loadCourts();
  }, []);

  /* =========================================================
     Bookings Data Loading
     ========================================================= */

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setIsLoading(true);
      setLoadError("");
      try {
        const rows: BookingRow[] = [];
        const pageSize = 500;
        for (let pageNumber = 1; ; pageNumber++) {
          const page: BookingRow[] = await getBookingsList({
            fromDate: todayDate,
            toDate: todayDate,
            status: CONFIRMED_STATUS,
            includePendingWalkIns: true,
            pageNumber,
            pageSize,
          }, controller.signal);
          rows.push(...page);
          if (page.length < pageSize) break;
        }
        if (!controller.signal.aborted) {
          setBookings(rows.sort((a, b) => a.slotStartTime.localeCompare(b.slotStartTime)));
        }
      } catch {
        if (!controller.signal.aborted) {
          setBookings([]);
          setLoadError("Unable to load today's guest schedule. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [todayDate]);

  const getScheduleStatus = (booking: BookingRow): ScheduleStatus => {
    const start = new Date(`${booking.slotDate}T${booking.slotStartTime}+05:30`);
    const end = new Date(`${booking.slotDate}T${booking.slotEndTime}+05:30`);

    if (now < start) return "upcoming";
    if (now >= start && now <= end) return "ongoing";
    return "completed";
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const courtBookings = useMemo(() => selectedCourtId
    ? bookings.filter(booking => booking.courtId === selectedCourtId)
    : bookings, [bookings, selectedCourtId]);

  const filteredBookings = useMemo(() => {
    if (!normalizedSearch) return courtBookings;

    return courtBookings.filter((booking) =>
      [booking.customerName, booking.phoneNumber]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [courtBookings, normalizedSearch]);

  const nextUpcomingId = useMemo(() => {
    const upcoming = courtBookings.find(
      (booking) => getScheduleStatus(booking) === "upcoming",
    );
    return upcoming?.id ?? null;
  }, [courtBookings, now]);

  const stats = useMemo(() => {
    const upcomingCount = courtBookings.filter(
      (booking) => getScheduleStatus(booking) === "upcoming",
    ).length;

    const ongoingCount = courtBookings.filter(
      (booking) => getScheduleStatus(booking) === "ongoing",
    ).length;

    const totalRevenue = courtBookings.reduce(
      (sum, booking) => sum + (booking.status === CONFIRMED_STATUS ? booking.bookingAmount : 0),
      0,
    );

    return {
      totalGuests: courtBookings.length,
      upcomingCount,
      ongoingCount,
      totalRevenue,
    };
  }, [courtBookings, now]);

  const walkInSlots = viewingBooking?.walkInId && isPendingWalkIn(viewingBooking)
    ? bookings.filter(booking => booking.walkInId === viewingBooking.walkInId && isPendingWalkIn(booking))
    : [];

  async function recordPayment(walkInId: string, paymentType: 1 | 2) {
    await payWalkIn(walkInId, paymentType);
    setBookings(current => current.map(booking => booking.walkInId === walkInId
      ? { ...booking, status: CONFIRMED_STATUS, paymentType }
      : booking));
    setViewingBooking(null);
    setPaymentNotice("Walk-in payment recorded.");
  }

  return (
    <main className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm shadow-amber-900/20">
              <CalendarClock size={22} />
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Today's Schedule
                </h1>

                <span className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
                  {formatDateDisplay(todayDate)}
                </span>
              </div>

              <p className="text-sm text-slate-500">
                Court bookings and walk-in payments for today.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            disabled={isLoading}
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-amber-900 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Summary Metric Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Guests Today"
            value={stats.totalGuests.toLocaleString()}
            subtitle="Confirmed bookings and pending walk-ins"
            icon={<Users size={20} />}
            iconClassName="bg-amber-50 text-amber-900"
          />

          <SummaryCard
            title="Upcoming"
            value={stats.upcomingCount.toLocaleString()}
            subtitle="Yet to arrive"
            icon={<Clock size={20} />}
            iconClassName="bg-blue-50 text-blue-600"
          />

          <SummaryCard
            title="Now Playing"
            value={stats.ongoingCount.toLocaleString()}
            subtitle="Currently on court"
            icon={<PlayCircle size={20} />}
            iconClassName="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            title="Today's Revenue"
            value={formatPrice(stats.totalRevenue)}
            subtitle="Payments collected"
            icon={<TrendingUp size={20} />}
            iconClassName="bg-violet-50 text-violet-600"
          />
        </div>

        {paymentNotice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{paymentNotice}</p>}

        {/* Schedule List */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:px-6">
            <div>
              <h2 className="font-bold text-slate-900">Guest Schedule</h2>
              <p className="text-xs text-slate-500">
                Review court times, guest details, and payments.
              </p>
            </div>

            <div className="flex flex-nowrap items-center gap-2.5 overflow-x-auto pb-0.5">
              <div className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 shadow-sm transition hover:border-amber-300 focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-50">
                <Search size={16} className="shrink-0 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full text-sm outline-none placeholder:text-slate-400"
                />
              </div>

              <FilterSelect
                icon={<SlidersHorizontal size={15} />}
                value={selectedCourtId}
                onChange={setSelectedCourtId}
              >
                <option value="">All Courts</option>
                {courts.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name}
                  </option>
                ))}
              </FilterSelect>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-100 border-t-amber-600" />
              <p className="text-sm text-slate-500">
                Loading today's schedule...
              </p>
            </div>
          ) : loadError ? (
            <div className="py-16 text-center text-sm text-red-600">
              {loadError}
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <CalendarClock size={26} />
              </div>
              <p className="font-semibold text-slate-700">
                {courtBookings.length === 0
                  ? "No bookings for today in the selected courts."
                  : "No guests match your search or filter."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredBookings.map((booking) => {
                const status = getScheduleStatus(booking);
                const isNext = booking.id === nextUpcomingId;

                return (
                  <div
                    key={booking.id}
                    className={`flex flex-col gap-3 p-4 transition sm:flex-row sm:items-center sm:gap-4 sm:p-5 ${
                      isNext
                        ? "bg-amber-50/40"
                        : "hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex w-full shrink-0 items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-900 sm:w-24 sm:flex-col sm:justify-center sm:py-2.5 sm:text-center">
                      <span className="text-sm font-bold leading-tight">
                        {formatTime(booking.slotStartTime)}
                      </span>
                      <span className="text-[11px] text-amber-700">
                        {formatTime(booking.slotEndTime)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-slate-900">
                          {booking.customerName}
                        </p>
                        <StatusBadge status={status} />
                        {booking.walkInId && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                            {isPendingWalkIn(booking) ? "Walk-in · Pending payment" : "Walk-in · Paid"}
                          </span>
                        )}
                        {isNext && (
                          <span className="inline-flex items-center rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Next Up
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Phone size={12} />
                          {booking.phoneNumber}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} />
                          {booking.courtName}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Hash size={12} />
                          {booking.bookingNumber}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center sm:gap-1.5">
                      <p className="font-bold text-slate-900">
                        {formatPrice(booking.bookingAmount)}
                      </p>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {isPendingWalkIn(booking) ? "Amount due" : paymentLabel(booking.paymentType)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => { setPaymentNotice(""); setViewingBooking(booking); }}
                      className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-amber-900 hover:bg-amber-50 hover:text-amber-700 sm:self-center"
                    >
                      {isPendingWalkIn(booking) ? "Take payment" : <><Eye size={14} /> View</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {viewingBooking && (
        <BookingDetailModal
          booking={viewingBooking}
          status={getScheduleStatus(viewingBooking)}
          formatPrice={formatPrice}
          formatTime={formatTime}
          formatDateDisplay={formatDateDisplay}
          paymentLabel={paymentLabel}
          walkInSlots={walkInSlots}
          onPay={recordPayment}
          onClose={() => setViewingBooking(null)}
        />
      )}
    </main>
  );
}

/* =========================================================
   Summary Card
   ========================================================= */

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  iconClassName,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  iconClassName: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-0.5 text-2xl font-bold text-slate-900 truncate">
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   Filter Select
   ========================================================= */

function FilterSelect({
  icon,
  value,
  onChange,
  disabled,
  children,
}: {
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative flex h-10 shrink-0 items-center gap-2 rounded-xl border pl-3 pr-8 shadow-sm transition ${
        disabled
          ? "border-slate-100 bg-slate-50"
          : "border-slate-200 bg-white hover:border-amber-300 focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-50"
      }`}
    >
      <span className={disabled ? "text-slate-300" : "text-slate-400"}>
        {icon}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full cursor-pointer appearance-none bg-transparent text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
      >
        {children}
      </select>

      <ChevronDown
        size={14}
        className={`pointer-events-none absolute right-3 ${
          disabled ? "text-slate-300" : "text-slate-400"
        }`}
      />
    </div>
  );
}

/* =========================================================
   Status Badge
   ========================================================= */

function StatusBadge({ status }: { status: ScheduleStatus }) {
  if (status === "ongoing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Now Playing
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
        Completed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
      Upcoming
    </span>
  );
}

/* =========================================================
   Booking Detail Modal
   ========================================================= */

function BookingDetailModal({
  booking,
  status,
  formatPrice,
  formatTime,
  formatDateDisplay,
  paymentLabel,
  walkInSlots,
  onPay,
  onClose,
}: {
  booking: BookingRow;
  status: ScheduleStatus;
  formatPrice: (price: number) => string;
  formatTime: (time: string) => string;
  formatDateDisplay: (date: string) => string;
  paymentLabel: (paymentType: number) => string;
  walkInSlots: BookingRow[];
  onPay: (walkInId: string, paymentType: 1 | 2) => Promise<void>;
  onClose: () => void;
}) {
  const [paymentType, setPaymentType] = useState<1 | 2>(1);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const paymentInFlight = useRef(false);
  const pendingWalkIn = isPendingWalkIn(booking) && Boolean(booking.walkInId);

  async function submitPayment() {
    if (!booking.walkInId || paymentInFlight.current) return;
    paymentInFlight.current = true;
    setIsPaying(true);
    setPaymentError("");
    try {
      await onPay(booking.walkInId, paymentType);
    } catch (error) {
      setPaymentError(bookingError(error));
    } finally {
      paymentInFlight.current = false;
      setIsPaying(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !paymentInFlight.current) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="today-booking-title" className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-600 text-white">
              <CalendarClock size={20} />
            </div>
            <div>
              <h2 id="today-booking-title" className="text-lg font-bold text-slate-900">
                {pendingWalkIn ? "Take walk-in payment" : "Booking Details"}
              </h2>
              <p className="text-xs text-slate-500">
                {booking.bookingNumber}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPaying}
            aria-label="Close booking details"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <DetailRow label="Guest Name" value={booking.customerName} />
            <DetailRow label="Phone" value={booking.phoneNumber} />
            <DetailRow
              label="Date"
              value={formatDateDisplay(booking.slotDate)}
            />
            {walkInSlots.length > 1 ? (
              <ul aria-label="Slots included in this payment" className="space-y-2 border-y border-slate-200 py-2">
                {walkInSlots.map(slot => (
                  <li key={slot.id} className="flex flex-wrap justify-between gap-x-3 text-slate-700">
                    <span className="font-medium">{slot.courtName}</span>
                    <span>{formatTime(slot.slotStartTime)} – {formatTime(slot.slotEndTime)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <DetailRow label="Court" value={booking.courtName} />
                <DetailRow label="Time Slot" value={`${formatTime(booking.slotStartTime)} – ${formatTime(booking.slotEndTime)}`} />
              </>
            )}
            <DetailRow
              label="Payment Method"
              value={pendingWalkIn ? "Pending payment" : paymentLabel(booking.paymentType)}
            />
            <div className="h-px bg-slate-200" />
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-amber-900">{pendingWalkIn ? `Total due (${walkInSlots.length} ${walkInSlots.length === 1 ? "slot" : "slots"})` : "Amount"}</span>
              <span className="text-base font-extrabold text-amber-900">
                {formatPrice(pendingWalkIn ? walkInSlots.reduce((total, slot) => total + slot.bookingAmount, 0) : booking.bookingAmount)}
              </span>
            </div>
          </div>

          {pendingWalkIn && (
            <fieldset className="flex gap-4 text-sm text-slate-700" disabled={isPaying}>
              <legend className="mb-2 font-semibold text-slate-900">Payment method</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="walk-in-payment" checked={paymentType === 1} onChange={() => setPaymentType(1)} /> Cash
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="walk-in-payment" checked={paymentType === 2} onChange={() => setPaymentType(2)} /> Card
              </label>
            </fieldset>
          )}
          {paymentError && <p role="alert" className="text-sm text-red-700">{paymentError}</p>}

          {booking.notes && (
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="text-xs font-semibold text-slate-500">Notes</p>
              <p className="mt-1 text-sm text-slate-800">{booking.notes}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isPaying}
            className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
          {pendingWalkIn && (
            <button type="button" onClick={() => void submitPayment()} disabled={isPaying || walkInSlots.length === 0}
              className="h-11 w-full rounded-xl bg-amber-700 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50">
              {isPaying ? "Recording…" : "Record payment"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}:</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
