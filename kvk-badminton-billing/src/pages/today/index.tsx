import { useEffect, useMemo, useState } from "react";
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
import { getBookingsList } from "@/services/booking-api";
import { getCourts } from "@/services/courts-api";

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
};

type CourtOption = {
  id: string;
  name: string;
};

type ScheduleStatus = "upcoming" | "ongoing" | "completed";

const CONFIRMED_STATUS = 2;

/* =========================================================
   Today's Schedule Page
   ========================================================= */

export default function Today() {
  const today = new Date();
  const todayDate = today.toISOString().split("T")[0];

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
    paymentType === 2 ? "Card" : "Cash";

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

  const loadTodaysBookings = async () => {
    try {
      setIsLoading(true);
      setLoadError("");

      const response = await getBookingsList({
        fromDate: todayDate,
        toDate: todayDate,
        status: CONFIRMED_STATUS,
        courtId: selectedCourtId || undefined,
        pageSize: 500,
      });

      const rows: BookingRow[] = Array.isArray(response) ? response : [];

      rows.sort((a, b) => a.slotStartTime.localeCompare(b.slotStartTime));

      setBookings(rows);
    } catch (error) {
      console.error("Failed to load today's bookings:", error);
      setBookings([]);
      setLoadError("Unable to load today's guest schedule. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTodaysBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourtId]);

  const getScheduleStatus = (booking: BookingRow): ScheduleStatus => {
    const start = new Date(`${booking.slotDate}T${booking.slotStartTime}`);
    const end = new Date(`${booking.slotDate}T${booking.slotEndTime}`);

    if (now < start) return "upcoming";
    if (now >= start && now <= end) return "ongoing";
    return "completed";
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredBookings = useMemo(() => {
    if (!normalizedSearch) return bookings;

    return bookings.filter((booking) =>
      [booking.customerName, booking.phoneNumber]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [bookings, normalizedSearch]);

  const nextUpcomingId = useMemo(() => {
    const upcoming = bookings.find(
      (booking) => getScheduleStatus(booking) === "upcoming",
    );
    return upcoming?.id ?? null;
  }, [bookings, now]);

  const stats = useMemo(() => {
    const upcomingCount = bookings.filter(
      (booking) => getScheduleStatus(booking) === "upcoming",
    ).length;

    const ongoingCount = bookings.filter(
      (booking) => getScheduleStatus(booking) === "ongoing",
    ).length;

    const totalRevenue = bookings.reduce(
      (sum, booking) => sum + booking.bookingAmount,
      0,
    );

    return {
      totalGuests: bookings.length,
      upcomingCount,
      ongoingCount,
      totalRevenue,
    };
  }, [bookings, now]);

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
                Confirmed guests booked to play badminton today, sorted
                by court time.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadTodaysBookings()}
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
            subtitle="Confirmed bookings"
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
            subtitle="From confirmed guests"
            icon={<TrendingUp size={20} />}
            iconClassName="bg-violet-50 text-violet-600"
          />
        </div>

        {/* Schedule List */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:px-6">
            <div>
              <h2 className="font-bold text-slate-900">Guest Schedule</h2>
              <p className="text-xs text-slate-500">
                Court time, guest details, and payment for each confirmed
                booking today.
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
                {bookings.length === 0
                  ? "No confirmed guests booked for today yet."
                  : "No guests match your search or filter."}
              </p>
              <p className="text-xs text-slate-400">
                Confirmed bookings for today will appear here automatically.
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
                        {paymentLabel(booking.paymentType)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setViewingBooking(booking)}
                      className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-amber-900 hover:bg-amber-50 hover:text-amber-700 sm:self-center"
                    >
                      <Eye size={14} />
                      View
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
  onClose,
}: {
  booking: BookingRow;
  status: ScheduleStatus;
  formatPrice: (price: number) => string;
  formatTime: (time: string) => string;
  formatDateDisplay: (date: string) => string;
  paymentLabel: (paymentType: number) => string;
  onClose: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-600 text-white">
              <CalendarClock size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Booking Details
              </h2>
              <p className="text-xs text-slate-500">
                {booking.bookingNumber}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
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
            <DetailRow label="Court" value={booking.courtName} />
            <DetailRow
              label="Date"
              value={formatDateDisplay(booking.slotDate)}
            />
            <DetailRow
              label="Time Slot"
              value={`${formatTime(booking.slotStartTime)} - ${formatTime(
                booking.slotEndTime,
              )}`}
            />
            <DetailRow
              label="Payment Method"
              value={paymentLabel(booking.paymentType)}
            />
            <div className="h-px bg-slate-200" />
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-amber-900">Amount</span>
              <span className="text-base font-extrabold text-amber-900">
                {formatPrice(booking.bookingAmount)}
              </span>
            </div>
          </div>

          {booking.notes && (
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="text-xs font-semibold text-slate-500">Notes</p>
              <p className="mt-1 text-sm text-slate-800">{booking.notes}</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
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
