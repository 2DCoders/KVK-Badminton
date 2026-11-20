import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, CalendarDays, Check, Clock3, Info, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Alert from "@/components/ui/alert";
import { getEnv } from "@/env";
import { getMemberBookingSetup, checkMemberBooking, checkAndHoldMemberBooking, quoteMemberCoupon,
  releaseMemberHold, confirmCashierBooking, bookingError,
  type BookingSetup, type BookingHold, type AvailabilityQuote, type CouponQuote, type BookingConfirmation } from "@/services/special-bookings-api";
import { WEEKDAYS, consecutiveSlots, countdown, endDate, isDate, maximumWeeks, remainingSeconds, slotTime, sriLankaToday, validateSchedule } from "./booking-utils";

const formatSlotTime = (start: string, end: string) => `${slotTime(start)} - ${slotTime(end)}`;
const PAYMENT_TYPE = { cash: 1, card: 2 } as const;
type PaymentMethod = keyof typeof PAYMENT_TYPE;

export default function SpecialBookingsPage() {
  const navigate = useNavigate();
  const env = getEnv();
  const today = sriLankaToday();
  const minDate = isDate(env.BADMINTON_BOOKING_START_DATE) && env.BADMINTON_BOOKING_START_DATE > today ? env.BADMINTON_BOOKING_START_DATE : today;
  const [setup, setSetup] = useState<BookingSetup | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [startDate, setStartDate] = useState(minDate);
  const [slotCount, setSlotCount] = useState("1");
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>(["Monday"]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponQuote, setCouponQuote] = useState<CouponQuote | null>(null);
  const [availabilityResult, setAvailabilityResult] = useState<(AvailabilityQuote & { durationInWeeks: number }) | null>(null);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [hold, setHold] = useState<BookingHold | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<BookingConfirmation | null>(null);
  const [pageAlert, setPageAlert] = useState<{ visible: boolean; variant?: "success" | "error" | "warning" | "info"; title?: string; description?: string }>({ visible: false });
  const lock = useRef(false);
  const holdRef = useRef<BookingHold | null>(null);
  const mounted = useRef(true);
  const occurrenceCount = Number(slotCount);
  const maxWeeks = Math.min(12, setup?.maximumWeeks ?? 12, maximumWeeks(env.BOOKING_DURATION) || 12);
  const courtSlots = setup?.slots ?? [];
  const selectedSlotObjects = courtSlots.filter(slot => selectedSlots.includes(slot.slotId));
  const selectedCourtName = setup?.court.name ?? "No court selected";
  const isLoadingCourts = loading;
  const isLoadingSlots = loading;
  const isCheckingAvailability = busy === "check" || busy === "hold";
  const isCreatingBooking = busy === "confirm";
  const isValidatingCoupon = busy === "coupon";
  const availabilityError = availabilityResult?.unavailableSchedules ?? [];
  const availabilityOriginalAmount = hold?.originalAmount ?? availabilityResult?.originalAmount ?? 0;
  const availabilityApiDiscount = 0;
  const couponDiscount = couponQuote?.discountAmount ?? 0;
  const couponApplied = !!couponQuote && appliedCoupon === couponCode.trim().toUpperCase();
  const payableAmount = couponQuote?.finalAmount ?? availabilityOriginalAmount;
  const paymentAmount = payableAmount;
  const seconds = hold ? remainingSeconds(deadline, now) : 0;
  const expired = !!hold && seconds === 0;
  const schedule = { startDate, weeks: occurrenceCount, slotIds: selectedSlots, daysOfWeek: selectedWeekdays };

  useEffect(() => {
    const controller = new AbortController();
    getMemberBookingSetup(controller.signal).then(data => {
      if (!controller.signal.aborted) { setSetup(data); setSlotCount(String(Math.min(12, maximumWeeks(env.BOOKING_DURATION) || 1, data.maximumWeeks))); }
    }).catch(reason => {
      if (!controller.signal.aborted) setPageAlert({ visible: true, variant: "error", title: "Unable to load bookings", description: bookingError(reason) });
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); };
  }, [env.BOOKING_DURATION]);
  useEffect(() => {
    if (!hold) return;
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); window.removeEventListener("focus", tick); };
  }, [hold]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (holdRef.current && !lock.current) void releaseMemberHold(holdRef.current.holdToken).catch(() => {});
    };
  }, []);

  function invalidate() { setAvailabilityResult(null); setCouponQuote(null); setAppliedCoupon(""); setReceipt(null); }
  function toggleWeekday(day: string) {
    if (lock.current || holdRef.current) return;
    invalidate(); setSelectedWeekdays(current => current.includes(day) ? current.filter(value => value !== day) : [...current, day]);
  }
  function toggleSlot(id: string) {
    if (lock.current || holdRef.current) return;
    const next = selectedSlots.includes(id) ? selectedSlots.filter(value => value !== id) : [...selectedSlots, id];
    if (next.length && !consecutiveSlots(next, courtSlots)) {
      setPageAlert({ visible: true, variant: "error", title: "Invalid selection", description: "Choose consecutive time slots without gaps. Remove an end slot first." }); return;
    }
    invalidate(); setSelectedSlots(next);
  }
  function handleSlotCountChange(value: string) { if (!lock.current && !holdRef.current && Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= maxWeeks) { invalidate(); setSlotCount(value); } }
  async function run(action: string, work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(action); setPageAlert({ visible: false });
    try { await work(); } catch (reason) { setPageAlert({ visible: true, variant: "error", title: "Unable to complete booking", description: bookingError(reason) }); }
    finally {
      lock.current = false; setBusy("");
      if (!mounted.current && holdRef.current) void releaseMemberHold(holdRef.current.holdToken).catch(() => {});
    }
  }
  function handleCheckAvailability() {
    const message = validateSchedule(startDate, minDate, occurrenceCount, maxWeeks, selectedWeekdays, selectedSlots, courtSlots);
    if (!setup || message) { setPageAlert({ visible: true, variant: "error", title: "Check your schedule", description: message || "Wait for the court to load." }); return; }
    void run("check", async () => {
      invalidate();
      const result = await checkMemberBooking(schedule);
      setAvailabilityResult({ ...result, durationInWeeks: occurrenceCount }); setShowAvailabilityModal(true);
    });
  }
  function reserve() {
    void run("hold", async () => {
      const result = await checkAndHoldMemberBooking(schedule);
      setAvailabilityResult({ ...result.availability, durationInWeeks: occurrenceCount });
      if (!result.hold) return;
      if (!result.hold.holdToken || result.hold.expiresInSeconds <= 0) throw new Error("Unable to reserve sessions. Check availability again.");
      holdRef.current = result.hold; setHold(result.hold);
      const clock = Date.now(); setDeadline(clock + result.hold.expiresInSeconds * 1000); setNow(clock);
      setCouponQuote(null); setAppliedCoupon("");
    });
  }
  function handleApplyCoupon() {
    if (!hold || remainingSeconds(deadline) === 0) return;
    const code = couponCode.trim().toUpperCase();
    void run("coupon", async () => {
      setCouponQuote(null); setAppliedCoupon("");
      if (!code) throw new Error("Enter an unredeemed coupon code.");
      const quote = await quoteMemberCoupon(hold.holdToken, code);
      setCouponQuote(quote); setAppliedCoupon(code);
    });
  }
  async function closeReview() {
    await run("release", async () => {
      if (holdRef.current) await releaseMemberHold(holdRef.current.holdToken);
      holdRef.current = null; setHold(null); setShowAvailabilityModal(false); invalidate();
    });
  }
  function handleConfirmBooking() {
    if (!hold || remainingSeconds(deadline) === 0) { setPageAlert({ visible: true, variant: "error", title: "Reservation expired", description: "Check availability and reserve your sessions again." }); return; }
    void run("confirm", async () => {
      if (!customerName.trim() || !/^\+?[0-9]{9,15}$/.test(phoneNumber.trim())) throw new Error("Enter the customer's name and a valid phone number.");
      if (!couponApplied) throw new Error("Apply an unredeemed coupon before confirming.");
      const result = await confirmCashierBooking({ holdToken: hold.holdToken, customerName: customerName.trim(), phoneNumber: phoneNumber.trim(), couponCode: appliedCoupon, paymentType: PAYMENT_TYPE[paymentMethod] });
      if (!result.succeeded || !result.bookings?.length) throw new Error("Booking has not been confirmed. Retry the same reservation.");
      holdRef.current = null; setHold(null); setShowAvailabilityModal(false); setReceipt(result);
      setAvailabilityResult(null); setCouponQuote(null); setAppliedCoupon(""); setCouponCode("");
      setPageAlert({ visible: true, variant: "success", title: "Special booking confirmed", description: `${result.bookings.length} sessions confirmed. Total: Rs. ${result.finalAmount.toLocaleString()}. Paid by ${paymentMethod === "cash" ? "Cash" : "Card"}.` });
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {pageAlert.visible && createPortal(
        <div>
          <Alert
            variant={pageAlert.variant}
            title={pageAlert.title}
            description={pageAlert.description}
            onClose={() => setPageAlert((s) => ({ ...s, visible: false }))}
          />
        </div>,
        document.body
      )}

      {/* =================================================
          HEADER
      ================================================== */}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
          Special Bookings
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Register recurring badminton
          court bookings for multiple
          days and time slots.
        </p>
        </div>
        

         <button
          type="button"
          onClick={() =>
            navigate("/special-bookings-availability")
          }
          className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          <ArrowRight size={16} />
          Available Bookings
        </button>
      </div>

      {/* =================================================
          ALERT
      ================================================== */}

      {receipt && <details className="mb-6 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-700"><summary className="cursor-pointer font-medium">Confirmed booking references</summary>{receipt.bookings.map(booking => <p key={booking.bookingNumber} className="mt-2 break-all">{booking.bookingDate} ? {booking.bookingNumber} ? Rs. {booking.bookingAmount.toLocaleString()}</p>)}</details>}

      {/* =================================================
          FORM
      ================================================== */}

      <fieldset disabled={!!busy || showAvailabilityModal} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-5 flex items-center gap-2">
          <CalendarDays size={18} />

          <div>
            <h2 className="font-semibold text-gray-900">
              Recurring Schedule
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Select one or more days
              and consecutive time
              slots.
            </p>
          </div>
        </div>

        {/* COURT */}

        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Court
          </label>

          <div className="rounded-xl border border-amber-500 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-amber-800">
                  {isLoadingCourts
                    ? "Loading courts..."
                    : selectedCourtName}
                </p>

                <p className="mt-0.5 text-xs text-amber-700">
                  Available for special
                  booking
                </p>
              </div>

              <Check
                size={19}
                className="text-amber-600"
              />
            </div>
          </div>
        </div>

        {/* BOOKING DAYS */}

        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Booking Days
            </label>

            <span className="text-xs text-gray-500">
              Select multiple days
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {WEEKDAYS.map(
              (day) => {
                const selected =
                  selectedWeekdays.includes(
                    day,
                  );

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      toggleWeekday(
                        day,
                      )
                    }
                    className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${selected
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                  >
                    {selected && (
                      <Check
                        size={14}
                      />
                    )}

                    {day}
                  </button>
                );
              },
            )}
          </div>

          <div className="mt-2 text-xs text-gray-500">
            Selected days:{" "}
            <span className="font-medium text-gray-700">
              {selectedWeekdays.join(
                ", ",
              )}
            </span>
          </div>
        </div>

        {/* TIME SLOTS */}

        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Time Slots
            </label>

            <span className="text-xs text-gray-500">
              Consecutive slots only
            </span>
          </div>

          {isLoadingSlots ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              <Clock3
                size={20}
                className="mx-auto mb-2 animate-pulse text-gray-400"
              />

              <p className="text-sm font-medium text-gray-600">
                Loading time slots...
              </p>
            </div>
          ) : courtSlots.length ===
            0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              <Clock3
                size={20}
                className="mx-auto mb-2 text-gray-400"
              />

              <p className="text-sm font-medium text-gray-600">
                No time slots
                available
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {courtSlots.map(
                (slot) => {
                  const selected =
                    selectedSlots.includes(
                      slot.slotId,
                    );

                  return (
                    <button
                      key={
                        slot.slotId
                      }
                      type="button"
                      onClick={() =>
                        toggleSlot(
                          slot.slotId,
                        )
                      }
                      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-sm font-medium transition ${selected
                        ? "border-amber-500 bg-amber-50 text-amber-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock3
                          size={15}
                        />

                        {formatSlotTime(
                          slot.startTime,
                          slot.endTime,
                        )}
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          )}
        </div>

        {/* DATE + DURATION */}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Starting Date
            </label>

            <input
              type="date"
              min={minDate}
              disabled={!!busy || !!hold}
              value={startDate}
              onChange={(e) =>
                (invalidate(), setStartDate(e.target.value))
              }
              className="mt-1.5 w-full cursor-pointer rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label htmlFor="special-booking-duration" className="text-sm font-medium text-gray-700">
              Duration (Weeks)
            </label>

            <select
              id="special-booking-duration"
              disabled={!!busy || !!hold}
              value={slotCount}
              onChange={(event) => handleSlotCountChange(event.target.value)}
              className="mt-1.5 w-full cursor-pointer rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500"
            >
              {Array.from({ length: maxWeeks }, (_, index) => index + 1).map(weeks => (
                <option key={weeks} value={weeks}>{weeks} {weeks === 1 ? "week" : "weeks"}</option>
              ))}
            </select>

            <p className="mt-1.5 text-xs text-gray-500">
              Choose 1 to {maxWeeks} recurring weeks. Ends {endDate(startDate, occurrenceCount) || "?"}.
            </p>
          </div>
        </div>

        {/* ACTION */}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={
              handleCheckAvailability
            }
            disabled={
              !!busy || loading
            }
            className="cursor-pointer rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCheckingAvailability
              ? "Checking..."
              : "Check Availability"}
          </button>
        </div>
      </fieldset>

      {/* =================================================
          LARGE AVAILABILITY MODAL
      ================================================== */}

      {showAvailabilityModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* HEADER */}

              <div className="flex shrink-0 items-center justify-between border-b bg-white px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {availabilityResult?.isAvailable
                      ? "Booking Available"
                      : "Booking Conflict"}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {availabilityResult?.isAvailable
                      ? "Review the booking and payment details."
                      : "Some selected schedules are unavailable."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void closeReview()}
                  disabled={!!busy}
                  className="rounded-full cursor-pointer p-2 hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* SCROLLABLE CONTENT */}

              <div className="overflow-y-auto">
                {!availabilityResult?.isAvailable ? (
                  <div className="p-6">
                    {/* CONFLICT */}

                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-5">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-red-100 p-2">
                          <X
                            size={18}
                            className="text-red-600"
                          />
                        </div>

                        <div>
                          <p className="font-semibold text-red-800">
                            Selected booking is
                            not available
                          </p>

                          <p className="mt-1 text-sm text-red-700">
                            One or more selected
                            schedules are already
                            booked for the requested
                            period.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* CONFLICT LIST */}

                    <div className="space-y-3">
                      {availabilityError.length >
                        0 ? (
                        availabilityError.map(
                          (
                            conflict,
                            index,
                          ) => (
                            <div
                              key={`${conflict.slotId}-${conflict.date}-${index}`}
                              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {
                                      conflict.date
                                    }
                                  </p>

                                  <p className="mt-1 text-sm text-gray-600">
                                    {
                                      conflict.slotName
                                    }
                                  </p>
                                </div>

                                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                                  Unavailable
                                </span>
                              </div>

                              <div className="mt-3 border-t border-gray-100 pt-3">
                                <p className="text-sm text-red-600">
                                  {
                                    conflict.message
                                  }
                                </p>
                              </div>
                            </div>
                          ),
                        )
                      ) : (
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                          The selected schedules
                          are not available for
                          the requested period.
                        </div>
                      )}
                    </div>

                    {/* DURATION */}

                    {availabilityResult && (
                      <div className="mt-5 rounded-xl bg-gray-50 p-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">
                            Requested Duration
                          </span>

                          <span className="font-medium text-gray-900">
                            {
                              availabilityResult.durationInWeeks
                            }{" "}
                            weeks
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-5 p-6">
                    {/* SUCCESS */}

                    <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-green-100 p-2">
                          <Check
                            size={18}
                            className="text-green-600"
                          />
                        </div>

                        <div>
                          <p className="font-semibold text-green-800">
                            All selected slots are
                            available
                          </p>

                          <p className="mt-1 text-sm text-green-700">
                            You can continue with
                            the payment details.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* BOOKING SUMMARY */}

                    <div className="rounded-xl border border-gray-200 p-5">
                      <h3 className="mb-4 text-sm font-semibold text-gray-900">
                        Booking Summary
                      </h3>

                      <div className="grid grid-cols-2 gap-5 text-sm md:grid-cols-4">
                        <div>
                          <p className="text-xs text-gray-500">
                            Court
                          </p>

                          <p className="mt-1 font-medium text-gray-900">
                            {
                              selectedCourtName
                            }
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">
                            Duration
                          </p>

                          <p className="mt-1 font-medium text-gray-900">
                            {
                              availabilityResult.durationInWeeks
                            }{" "}
                            weeks
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">
                            Booking Days
                          </p>

                          <p className="mt-1 font-medium text-gray-900">
                            {
                              selectedWeekdays.length
                            }
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">
                            Starting Date
                          </p>

                          <p className="mt-1 font-medium text-gray-900">
                            {startDate}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 border-t border-gray-100 pt-4">
                        <p className="text-xs text-gray-500">
                          Booking Days
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedWeekdays.map(
                            (day) => (
                              <span
                                key={day}
                                className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700"
                              >
                                {day}
                              </span>
                            ),
                          )}
                        </div>
                      </div>

                      <div className="mt-5 border-t border-gray-100 pt-4">
                        <p className="text-xs text-gray-500">
                          Time Slots
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedSlotObjects.map(
                            (slot) => (
                              <span
                                key={
                                  slot.slotId
                                }
                                className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700"
                              >
                                {formatSlotTime(
                                  slot.startTime,
                                  slot.endTime,
                                )}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    </div>

                    {!hold ? <button type="button" onClick={reserve} disabled={!!busy} className="rounded-lg cursor-pointer bg-amber-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">{isCheckingAvailability ? "Reserving..." : "Reserve sessions"}</button> : <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" role="status">
                      {expired ? "Your reservation has expired. Cancel and check availability again." : `Sessions reserved for ${countdown(seconds)}. Complete your booking before the hold expires.`}
                    </div>
                    <fieldset disabled={!!busy || expired} className="space-y-5 min-w-0 border-0 p-0 m-0">
                    {/* PAYMENT SUMMARY */}

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                      <h3 className="mb-4 text-sm font-semibold text-amber-900">
                        Payment Summary
                      </h3>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-amber-700">
                            Original Amount
                          </span>

                          <span className="font-medium text-amber-900">
                            Rs.{" "}
                            {availabilityOriginalAmount.toLocaleString()}
                          </span>
                        </div>

                        {availabilityApiDiscount >
                          0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-green-700">
                                API Discount
                              </span>

                              <span className="font-medium text-green-700">
                                - Rs.{" "}
                                {availabilityApiDiscount.toLocaleString()}
                              </span>
                            </div>
                          )}

                        {couponDiscount >
                          0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-green-700">
                                Coupon Discount
                              </span>

                              <span className="font-medium text-green-700">
                                - Rs.{" "}
                                {couponDiscount.toLocaleString()}
                              </span>
                            </div>
                          )}

                        <div className="border-t border-amber-200 pt-3">
                          <div className="flex justify-between">
                            <span className="font-semibold text-amber-800">
                              Final Amount
                            </span>

                            <span className="text-xl font-bold text-amber-900">
                              Rs.{" "}
                              {payableAmount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* COUPON */}

                    <div className="rounded-xl border border-gray-200 p-5">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Coupon Code
                      </label>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={
                            couponCode
                          }
                          onChange={(e) => {
                            setCouponCode(
                              e.target.value.toUpperCase(),
                            );

                            setAppliedCoupon("");
                            setCouponQuote(null);
                          }}
                          placeholder="Enter coupon code"
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm uppercase outline-none focus:border-amber-500"
                        />

                        <button
                          type="button"
                          onClick={
                            handleApplyCoupon
                          }
                          disabled={
                            isValidatingCoupon
                          }
                          className="rounded-lg border border-amber-600 px-5 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                        >
                          {isValidatingCoupon
                            ? "Checking..."
                            : "Apply"}
                        </button>
                      </div>

                      {couponApplied && (
                        <p className="mt-2 text-xs font-medium text-green-600">
                          Coupon applied
                          successfully.
                        </p>
                      )}
                    </div>

                    {/* PAYMENT AMOUNT */}

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">
                          Payment Amount
                        </span>

                        <span className="text-xl font-bold text-gray-900">
                          Rs.{" "}
                          {paymentAmount.toLocaleString()}
                        </span>
                      </div>

                    </div>

                    {/* PAYMENT METHOD */}

                    <div className="rounded-xl border border-gray-200 p-5">
                      <label className="mb-3 block text-sm font-medium text-gray-700">
                        Payment Method
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setPaymentMethod(
                              "cash",
                            )
                          }
                          className={`rounded-xl cursor-pointer border px-4 py-3 text-sm font-medium transition ${paymentMethod ===
                            "cash"
                            ? "border-amber-500 bg-amber-50 text-amber-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                            }`}
                        >
                          Cash
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setPaymentMethod(
                              "card",
                            )
                          }
                          className={`rounded-xl cursor-pointer border px-4 py-3 text-sm font-medium transition ${paymentMethod ===
                            "card"
                            ? "border-amber-500 bg-amber-50 text-amber-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                            }`}
                        >
                          Card
                        </button>
                      </div>
                    </div>

                    {/* CUSTOMER */}
                    <div className="rounded-xl border border-gray-200 p-5 space-y-4">
                      <div><label htmlFor="special-customer" className="mb-2 block text-sm font-medium text-gray-700">Customer Name</label>
                        <input id="special-customer" type="text" maxLength={100} value={customerName} onChange={event => setCustomerName(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500" /></div>
                      <div><label htmlFor="special-phone" className="mb-2 block text-sm font-medium text-gray-700">Phone Number</label>
                        <input id="special-phone" type="tel" maxLength={16} value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500" /></div>
                    </div>

                    {/* INFO */}

                    <div className="flex items-start gap-2 rounded-xl bg-gray-50 p-4 text-xs leading-5 text-gray-500">
                      <Info
                        size={15}
                        className="mt-0.5 shrink-0"
                      />

                      <p>
                        This booking will
                        create recurring
                        reservations for every
                        selected day for the
                        selected duration.
                      </p>
                    </div>
                    </fieldset>
                    </>}
                  </div>
                )}
              </div>

              {/* FOOTER */}

              {availabilityResult?.isAvailable && (
                <div className="flex shrink-0 justify-end gap-3 border-t bg-gray-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => void closeReview()}
                    disabled={!!busy}
                    className="rounded-lg cursor-pointer border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleConfirmBooking
                    }
                    disabled={
                      !!busy || !hold || expired || !couponApplied || !customerName.trim() || !/^\+?[0-9]{9,15}$/.test(phoneNumber.trim())
                    }
                    className="rounded-lg cursor-pointer bg-gradient-to-r from-amber-500 via-amber-600 to-orange-700 px-6 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingBooking
                      ? "Creating..."
                      : "Confirm Booking"}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}