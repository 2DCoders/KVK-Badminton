import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  Info,
  X,
} from "lucide-react";

import { getCourts } from "@/services/courts-api";
import { getSlotByCourtId } from "@/services/slots-api";

type PaymentPlan = "full" | "installments";
type PaymentMethod = "cash" | "card";

interface RecurringBooking {
  id: string;
  customerName: string;
  phone: string;
  weekdays: string[];
  time: string;
  startDate: string;
  endDate: string;
  occurrences: number;
  paymentPlan: PaymentPlan;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  paidAmount: number;
  couponCode?: string;
  status: "Confirmed" | "Conflict Review";
}

interface CourtSlot {
  courtId: string;
  slotId: string;
  startTime: string;
  endTime: string;
  price: number;
}

interface Court {
  id: string;
  name: string;
  [key: string]: unknown;
}

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DUMMY_BOOKINGS: RecurringBooking[] = [
  {
    id: "SB-0001",
    customerName: "Kasun Perera",
    phone: "0771234567",
    weekdays: ["Monday"],
    time: "5:00 PM - 6:00 PM",
    startDate: "2026-09-07",
    endDate: "2027-03-01",
    occurrences: 26,
    paymentPlan: "full",
    paymentMethod: "cash",
    totalAmount: 39000,
    paidAmount: 39000,
    status: "Confirmed",
  },
  {
    id: "SB-0002",
    customerName: "Nimal Fernando",
    phone: "0714567890",
    weekdays: ["Wednesday"],
    time: "7:00 PM - 8:00 PM",
    startDate: "2026-09-02",
    endDate: "2027-02-24",
    occurrences: 26,
    paymentPlan: "installments",
    paymentMethod: "card",
    totalAmount: 39000,
    paidAmount: 19500,
    couponCode: "KVK10",
    status: "Confirmed",
  },
  {
    id: "SB-0003",
    customerName: "Ruwan Silva",
    phone: "0759876543",
    weekdays: ["Monday", "Wednesday"],
    time: "5:00 PM - 6:00 PM",
    startDate: "2026-10-05",
    endDate: "2027-03-29",
    occurrences: 26,
    paymentPlan: "full",
    paymentMethod: "cash",
    totalAmount: 78000,
    paidAmount: 78000,
    status: "Conflict Review",
  },
];

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return 0;
  }

  return hours * 60 + minutes;
};

const formatTime = (totalMinutes: number): string => {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;

  return `${hours12}:${String(minutes).padStart(
    2,
    "0",
  )} ${period}`;
};

const formatSlotTime = (
  startTime: string,
  endTime: string,
): string => {
  return `${formatTime(
    timeToMinutes(startTime),
  )} - ${formatTime(timeToMinutes(endTime))}`;
};

export default function SpecialBookingsPage() {
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  /**
   * Multiple weekdays can be selected.
   *
   * Example:
   * ["Monday", "Wednesday", "Friday"]
   */
  const [selectedWeekdays, setSelectedWeekdays] =
    useState<string[]>(["Monday"]);

  /**
   * Selected API slot IDs.
   */
  const [selectedSlots, setSelectedSlots] =
    useState<string[]>([]);

  const [startDate, setStartDate] =
    useState("2026-09-07");

  /**
   * Number of weeks/occurrences.
   *
   * Example:
   * 4 occurrences + 3 selected days
   *
   * = 12 actual booking occurrences.
   */
  const [slotCount, setSlotCount] = useState("4");

  const [paymentPlan, setPaymentPlan] =
    useState<PaymentPlan>("full");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] =
    useState(false);

  const [showConfirmModal, setShowConfirmModal] =
    useState(false);

  const [bookings, setBookings] =
    useState<RecurringBooking[]>(DUMMY_BOOKINGS);

  const [alert, setAlert] = useState("");

  const [courts, setCourts] = useState<Court[]>([]);

  /**
   * Actual slots returned from API.
   */
  const [courtSlots, setCourtSlots] =
    useState<CourtSlot[]>([]);

  const [isLoadingCourts, setIsLoadingCourts] =
    useState(false);

  const [isLoadingSlots, setIsLoadingSlots] =
    useState(false);

  /**
   * Selected occurrence count.
   *
   * Example:
   *
   * 4 = 4 weeks
   */
  const occurrenceCount = useMemo(() => {
    const value = Number(slotCount);

    if (!Number.isInteger(value) || value < 1) {
      return 0;
    }

    return value;
  }, [slotCount]);

  /**
   * Actual slot objects selected by user.
   */
  const selectedSlotObjects = useMemo(() => {
    return courtSlots.filter((slot) =>
      selectedSlots.includes(slot.slotId),
    );
  }, [courtSlots, selectedSlots]);

  /**
   * Total actual recurring booking occurrences.
   *
   * Example:
   *
   * 4 weeks
   * × Monday, Wednesday, Friday
   * = 12 occurrences
   */
  const totalOccurrences =
    occurrenceCount * selectedWeekdays.length;

  /**
   * Total actual slot bookings.
   *
   * Example:
   *
   * 4 weeks
   * × 3 days
   * × 2 time slots
   * = 24 slots
   */
  const totalSlots =
    totalOccurrences *
    selectedSlotObjects.length;

  /**
   * Price for one selected day.
   *
   * Example:
   *
   * 08:00 - 09:00 = 2000
   * 09:00 - 10:00 = 2000
   *
   * One day = 4000
   */
  const singleDaySlotPrice = useMemo(() => {
    return selectedSlotObjects.reduce(
      (sum, slot) =>
        sum + Number(slot.price || 0),
      0,
    );
  }, [selectedSlotObjects]);

  /**
   * Full recurring subtotal.
   */
  const subtotal = useMemo(() => {
    return (
      singleDaySlotPrice *
      totalOccurrences
    );
  }, [
    singleDaySlotPrice,
    totalOccurrences,
  ]);

  const discount = couponApplied
    ? Math.round(subtotal * 0.1)
    : 0;

  const totalAmount = Math.max(
    0,
    subtotal - discount,
  );

  const installmentAmount =
    totalAmount > 0
      ? Math.ceil(totalAmount / 2)
      : 0;

  /**
   * Selected slot display text.
   */
  const selectedSlotTimes = useMemo(() => {
    return selectedSlotObjects
      .map((slot) =>
        formatSlotTime(
          slot.startTime,
          slot.endTime,
        ),
      )
      .join(", ");
  }, [selectedSlotObjects]);

  /**
   * Multiple weekday selection.
   */
  const toggleWeekday = (day: string) => {
    setSelectedWeekdays((current) => {
      if (current.includes(day)) {
        if (current.length === 1) {
          setAlert(
            "At least one day must be selected.",
          );

          return current;
        }

        return current.filter(
          (item) => item !== day,
        );
      }

      return [...current, day];
    });
  };

  /**
   * Slot count input.
   */
  const handleSlotCountChange = (
    value: string,
  ) => {
    if (value === "") {
      setSlotCount("");
      return;
    }

    if (!/^\d+$/.test(value)) {
      return;
    }

    const numericValue = Number(value);

    if (!Number.isSafeInteger(numericValue)) {
      return;
    }

    if (numericValue < 1) {
      return;
    }

    setSlotCount(String(numericValue));
  };

  /**
   * Select/deselect slots.
   *
   * Only consecutive slots can be selected.
   */
  const toggleSlot = (slotId: string) => {
    setAlert("");

    setSelectedSlots((current) => {
      /**
       * Remove selected slot.
       */
      if (current.includes(slotId)) {
        return current.filter(
          (id) => id !== slotId,
        );
      }

      /**
       * First slot.
       */
      if (current.length === 0) {
        return [slotId];
      }

      const indexes = current
        .map((id) =>
          courtSlots.findIndex(
            (slot) => slot.slotId === id,
          ),
        )
        .filter((index) => index >= 0);

      const newIndex = courtSlots.findIndex(
        (slot) => slot.slotId === slotId,
      );

      if (
        newIndex < 0 ||
        indexes.length === 0
      ) {
        return current;
      }

      const currentMin = Math.min(...indexes);
      const currentMax = Math.max(...indexes);

      /**
       * Only allow immediate previous/next slot.
       */
      if (
        newIndex === currentMin - 1 ||
        newIndex === currentMax + 1
      ) {
        return [...current, slotId].sort(
          (a, b) => {
            const indexA =
              courtSlots.findIndex(
                (slot) =>
                  slot.slotId === a,
              );

            const indexB =
              courtSlots.findIndex(
                (slot) =>
                  slot.slotId === b,
              );

            return indexA - indexB;
          },
        );
      }

      setAlert(
        "Only consecutive time slots can be selected.",
      );

      return current;
    });
  };

  /**
   * Fetch slots for selected court.
   */
  const handleGetSlotsById = async (
    courtId: string,
  ) => {
    try {
      setIsLoadingSlots(true);
      setAlert("");

      /**
       * New API:
       *
       * [
       *   {
       *     courtId,
       *     slotId,
       *     startTime,
       *     endTime,
       *     price
       *   }
       * ]
       */
      const response =
        await getSlotByCourtId(courtId);

      console.log(
        "Slots for court:",
        courtId,
        response,
      );

      const slots = (response ??
        []) as CourtSlot[];

      if (
        !Array.isArray(slots) ||
        slots.length === 0
      ) {
        setCourtSlots([]);
        setSelectedSlots([]);

        setAlert(
          "No booking slots found for this court.",
        );

        return;
      }

      const validSlots = slots
        .filter(
          (slot) =>
            slot.courtId === courtId &&
            !!slot.slotId &&
            !!slot.startTime &&
            !!slot.endTime,
        )
        .sort(
          (a, b) =>
            timeToMinutes(
              a.startTime,
            ) -
            timeToMinutes(
              b.startTime,
            ),
        );

      setCourtSlots(validSlots);

      /**
       * Automatically select first slot.
       */
      setSelectedSlots(
        validSlots.length > 0
          ? [validSlots[0].slotId]
          : [],
      );

      if (validSlots.length === 0) {
        setAlert(
          "No valid booking slots found for this court.",
        );
      }
    } catch (error) {
      console.error(
        "Error fetching slots:",
        error,
      );

      setCourtSlots([]);
      setSelectedSlots([]);

      setAlert(
        "Failed to fetch slots. Please try again later.",
      );
    } finally {
      setIsLoadingSlots(false);
    }
  };

  /**
   * Fetch courts.
   */
  const handleGetCourts = async () => {
    try {
      setIsLoadingCourts(true);
      setAlert("");

      const response = await getCourts();

      const courtList =
        (response ?? []) as Court[];

      setCourts(courtList);

      if (courtList.length > 0) {
        await handleGetSlotsById(
          courtList[0].id,
        );
      } else {
        setCourtSlots([]);
        setSelectedSlots([]);

        setAlert(
          "No badminton courts are available.",
        );
      }
    } catch (error) {
      console.error(
        "Error fetching courts:",
        error,
      );

      setCourts([]);
      setCourtSlots([]);
      setSelectedSlots([]);

      setAlert(
        "Failed to fetch courts. Please try again later.",
      );
    } finally {
      setIsLoadingCourts(false);
    }
  };

  /**
   * Initial loading.
   */
  useEffect(() => {
    handleGetCourts();
  }, []);

  /**
   * Apply coupon.
   */
  const handleApplyCoupon = () => {
    const code =
      couponCode.trim().toUpperCase();

    if (!code) {
      setAlert(
        "Please enter a coupon code.",
      );

      return;
    }

    if (code === "KVK10") {
      setCouponApplied(true);
      setAlert(
        "Coupon applied successfully.",
      );
    } else {
      setCouponApplied(false);
      setAlert("Invalid coupon code.");
    }
  };

  /**
   * Create booking validation.
   */
  const handleCreateBooking = () => {
    setAlert("");

    if (!customerName.trim()) {
      setAlert(
        "Please enter customer name.",
      );

      return;
    }

    if (!phoneNumber.trim()) {
      setAlert(
        "Please enter phone number.",
      );

      return;
    }

    if (selectedWeekdays.length === 0) {
      setAlert(
        "Please select at least one day.",
      );

      return;
    }

    if (selectedSlotObjects.length === 0) {
      setAlert(
        "Please select at least one time slot.",
      );

      return;
    }

    if (occurrenceCount < 1) {
      setAlert(
        "Please enter a valid number of weeks.",
      );

      return;
    }

    if (!startDate) {
      setAlert(
        "Please select a starting date.",
      );

      return;
    }

    if (totalAmount <= 0) {
      setAlert(
        "Booking amount must be greater than zero.",
      );

      return;
    }

    setShowConfirmModal(true);
  };

  /**
   * Confirm booking.
   */
  const handleConfirmBooking = () => {
    const newBooking: RecurringBooking = {
      id: `SB-${String(
        bookings.length + 1,
      ).padStart(4, "0")}`,

      customerName,

      phone: phoneNumber,

      weekdays: [...selectedWeekdays],

      time: selectedSlotTimes,

      startDate,

      endDate: `${occurrenceCount} weeks`,

      occurrences: totalOccurrences,

      paymentPlan,

      paymentMethod,

      totalAmount,

      paidAmount:
        paymentPlan === "full"
          ? totalAmount
          : installmentAmount,

      couponCode: couponApplied
        ? couponCode.toUpperCase()
        : undefined,

      status: "Confirmed",
    };

    setBookings((current) => [
      newBooking,
      ...current,
    ]);

    setShowConfirmModal(false);

    /**
     * Reset customer details.
     */
    setCustomerName("");
    setPhoneNumber("");

    /**
     * Keep Monday selected as default.
     */
    setSelectedWeekdays(["Monday"]);

    /**
     * Keep first slot selected.
     */
    setSelectedSlots(
      courtSlots.length > 0
        ? [courtSlots[0].slotId]
        : [],
    );

    setSlotCount("1");

    setCouponCode("");
    setCouponApplied(false);

    setAlert(
      "Special booking created and confirmed successfully.",
    );
  };

  const selectedCourtName =
    courts.length > 0
      ? courts[0].name
      : "No court selected";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* =====================================================
          HEADER
      ====================================================== */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Special Bookings
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Register recurring badminton court bookings
          for multiple days and time slots.
        </p>
      </div>

      {/* =====================================================
          ALERT
      ====================================================== */}
      {alert && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
          <span>{alert}</span>

          <button
            type="button"
            onClick={() => setAlert("")}
            className="rounded-lg p-1 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* =====================================================
          FORM
      ====================================================== */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          {/* Header */}
          <div className="mb-5 flex items-center gap-2">
            <CalendarDays size={18} />

            <div>
              <h2 className="font-semibold text-gray-900">
                Recurring Schedule
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Select one or more days and consecutive
                time slots.
              </p>
            </div>
          </div>

          {/* =================================================
              COURT
          ================================================== */}
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
                    Available for special booking
                  </p>
                </div>

                <Check
                  size={19}
                  className="text-amber-600"
                />
              </div>
            </div>
          </div>

          {/* =================================================
              MULTIPLE WEEKDAYS
          ================================================== */}
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
              {WEEKDAYS.map((day) => {
                const selected =
                  selectedWeekdays.includes(day);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      toggleWeekday(day)
                    }
                    className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                      selected
                        ? "border-amber-500 bg-amber-50 text-amber-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {selected && (
                      <Check size={14} />
                    )}

                    {day}
                  </button>
                );
              })}
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

          {/* =================================================
              TIME SLOTS
          ================================================== */}
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
            ) : courtSlots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                <Clock3
                  size={20}
                  className="mx-auto mb-2 text-gray-400"
                />

                <p className="text-sm font-medium text-gray-600">
                  No time slots available
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {courtSlots.map((slot) => {
                  const selected =
                    selectedSlots.includes(
                      slot.slotId,
                    );

                  return (
                    <button
                      key={slot.slotId}
                      type="button"
                      onClick={() =>
                        toggleSlot(
                          slot.slotId,
                        )
                      }
                      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                        selected
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock3 size={15} />

                        {formatSlotTime(
                          slot.startTime,
                          slot.endTime,
                        )}
                      </div>

                      {/* <span className="text-xs">
                        Rs.{" "}
                        {Number(
                          slot.price,
                        ).toLocaleString()}
                      </span> */}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* =================================================
              DATE + OCCURRENCES
          ================================================== */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Starting Date
              </label>

              <input
                type="date"
                value={startDate}
                onChange={(e) =>
                  setStartDate(
                    e.target.value,
                  )
                }
                className="mt-1.5 w-full cursor-pointer rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Number of Slots (Duration)
              </label>

              <input
                type="number"
                min={4}
                step={1}
                inputMode="numeric"
                value={slotCount}
                onChange={(e) =>
                  handleSlotCountChange(
                    e.target.value,
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "-" ||
                    e.key === "+" ||
                    e.key === "." ||
                    e.key === "e" ||
                    e.key === "E"
                  ) {
                    e.preventDefault();
                  }
                }}
                onWheel={(e) =>
                  e.currentTarget.blur()
                }
                placeholder="Enter number of slots"
                className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500"
              />

              <p className="mt-1.5 text-xs text-gray-500">
                Example: 4 slots = 1 month, 8 slots = 2 months, etc.
              </p>
            </div>
          </div>

          {/* =================================================
              CUSTOMER
          ================================================== */}
          {/* <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Customer Name
              </label>

              <input
                type="text"
                value={customerName}
                onChange={(e) =>
                  setCustomerName(
                    e.target.value,
                  )
                }
                placeholder="Enter customer name"
                className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Phone Number
              </label>

              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) =>
                  setPhoneNumber(
                    e.target.value,
                  )
                }
                placeholder="Enter phone number"
                className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* =================================================
              COUPON
          ================================================== */}
          {/* <div className="mt-5">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Coupon Code
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(
                    e.target.value.toUpperCase(),
                  );

                  setCouponApplied(false);
                }}
                placeholder="Enter coupon code"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm uppercase outline-none focus:border-amber-500"
              />

              <button
                type="button"
                onClick={handleApplyCoupon}
                className="rounded-lg border border-amber-600 px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-50"
              >
                Apply
              </button>
            </div>
          </div> */}

          {/* =================================================
              PAYMENT
          ================================================== */}
          {/* <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Payment Plan
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPaymentPlan("full")
                  }
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
                    paymentPlan === "full"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  Full Payment
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPaymentPlan(
                      "installments",
                    )
                  }
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
                    paymentPlan ===
                    "installments"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  Installments
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Payment Method
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPaymentMethod("cash")
                  }
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
                    paymentMethod === "cash"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  Cash
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPaymentMethod("card")
                  }
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
                    paymentMethod === "card"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  Card
                </button>
              </div>
            </div>
          </div> */}

          {/* =================================================
              PRICE SUMMARY
          ================================================== */}
          {/* <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-amber-700">
                  Selected Days
                </p>

                <p className="mt-1 font-semibold text-amber-800">
                  {selectedWeekdays.length}
                </p>
              </div>

              <div>
                <p className="text-xs text-amber-700">
                  Slots / Day
                </p>

                <p className="mt-1 font-semibold text-amber-800">
                  {selectedSlotObjects.length}
                </p>
              </div>

              <div>
                <p className="text-xs text-amber-700">
                  Weeks
                </p>

                <p className="mt-1 font-semibold text-amber-800">
                  {occurrenceCount || 0}
                </p>
              </div>

              <div>
                <p className="text-xs text-amber-700">
                  Total Booked Slots
                </p>

                <p className="mt-1 font-semibold text-amber-800">
                  {totalSlots}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-amber-200 pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-amber-700">
                  Subtotal
                </span>

                <span className="font-medium text-amber-800">
                  Rs.{" "}
                  {subtotal.toLocaleString()}
                </span>
              </div>

              {couponApplied && (
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-green-700">
                    Discount
                  </span>

                  <span className="font-medium text-green-700">
                    - Rs.{" "}
                    {discount.toLocaleString()}
                  </span>
                </div>
              )}

              <div className="mt-3 flex justify-between border-t border-amber-200 pt-3">
                <span className="font-medium text-amber-700">
                  Total Amount
                </span>

                <span className="text-lg font-bold text-amber-800">
                  Rs.{" "}
                  {totalAmount.toLocaleString()}
                </span>
              </div>

              {paymentPlan ===
                "installments" && (
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-amber-700">
                    First Payment
                  </span>

                  <span className="font-semibold text-amber-800">
                    Rs.{" "}
                    {installmentAmount.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div> */}

          {/* =================================================
              ACTIONS
          ================================================== */}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (
                  selectedWeekdays.length ===
                  0
                ) {
                  setAlert(
                    "Please select at least one day.",
                  );

                  return;
                }

                if (
                  selectedSlotObjects.length ===
                  0
                ) {
                  setAlert(
                    "Please select at least one time slot.",
                  );

                  return;
                }

                setAlert(
                  `Availability checked for ${selectedWeekdays.length} day(s) and ${selectedSlotObjects.length} time slot(s).`,
                );
              }}
              className="cursor-pointer rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600"
            >
              Check Availability
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================
          CONFIRMATION MODAL
      ====================================================== */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Confirm Special Booking
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Review the recurring booking
                  details.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowConfirmModal(false)
                }
                className="rounded-full p-2 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 p-5">
              {/* Customer */}
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">
                      Customer
                    </p>

                    <p className="mt-1 font-medium">
                      {customerName}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Phone
                    </p>

                    <p className="mt-1 font-medium">
                      {phoneNumber}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Court
                    </p>

                    <p className="mt-1 font-medium">
                      {selectedCourtName}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Starting Date
                    </p>

                    <p className="mt-1 font-medium">
                      {startDate}
                    </p>
                  </div>
                </div>
              </div>

              {/* Days */}
              <div className="rounded-xl border border-gray-200 p-4">
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

              {/* Time slots */}
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-3 text-sm font-semibold text-gray-800">
                  Selected Time Slots
                </p>

                <div className="space-y-2">
                  {selectedSlotObjects.map(
                    (slot) => (
                      <div
                        key={slot.slotId}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                      >
                        <span className="text-sm text-gray-600">
                          {formatSlotTime(
                            slot.startTime,
                            slot.endTime,
                          )}
                        </span>

                        <span className="text-sm font-medium text-gray-800">
                          Rs.{" "}
                          {Number(
                            slot.price,
                          ).toLocaleString()}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {/* Recurrence */}
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">
                      Selected Days
                    </p>

                    <p className="mt-1 font-medium">
                      {selectedWeekdays.length}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Weeks
                    </p>

                    <p className="mt-1 font-medium">
                      {occurrenceCount}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Booking Occurrences
                    </p>

                    <p className="mt-1 font-medium">
                      {totalOccurrences}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Total Slots
                    </p>

                    <p className="mt-1 font-medium">
                      {totalSlots}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-amber-700">
                    Subtotal
                  </span>

                  <span className="font-medium text-amber-800">
                    Rs.{" "}
                    {subtotal.toLocaleString()}
                  </span>
                </div>

                {couponApplied && (
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-green-700">
                      Discount
                    </span>

                    <span className="font-medium text-green-700">
                      - Rs.{" "}
                      {discount.toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="mt-3 flex justify-between border-t border-amber-200 pt-3">
                  <span className="font-medium text-amber-700">
                    Total Amount
                  </span>

                  <span className="text-lg font-bold text-amber-800">
                    Rs.{" "}
                    {totalAmount.toLocaleString()}
                  </span>
                </div>

                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-amber-700">
                    Payment Plan
                  </span>

                  <span className="font-medium capitalize text-amber-800">
                    {paymentPlan}
                  </span>
                </div>

                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-amber-700">
                    Payment Method
                  </span>

                  <span className="font-medium capitalize text-amber-800">
                    {paymentMethod}
                  </span>
                </div>

                {paymentPlan ===
                  "installments" && (
                  <div className="mt-3 flex justify-between border-t border-amber-200 pt-3 text-sm">
                    <span className="font-medium text-amber-700">
                      First Payment
                    </span>

                    <span className="font-bold text-amber-800">
                      Rs.{" "}
                      {installmentAmount.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex items-start gap-2 text-xs leading-5 text-gray-500">
                <Info
                  size={15}
                  className="mt-0.5 shrink-0"
                />

                <p>
                  This booking will create recurring
                  reservations for every selected day
                  for the selected number of weeks.
                  After payment, the special booking
                  will be confirmed.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t bg-gray-50 p-4">
              <button
                type="button"
                onClick={() =>
                  setShowConfirmModal(false)
                }
                className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmBooking}
                className="rounded-lg bg-gradient-to-r from-amber-500 via-amber-600 to-orange-700 px-5 py-2.5 text-sm font-medium text-white"
              >
                Confirm & Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}