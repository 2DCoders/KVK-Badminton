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
import { checkAvailabilityTemp } from "@/services/booking-api";
import { createPortal } from "react-dom";

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

interface CheckAvailabilityRequest {
  courtId: string;
  startDate: string;
  numberOfSlots: number;
  slotIds: string[];
  daysOfWeek: string[];
}

interface UnavailableSchedule {
  dayOfWeek: string;
  slotId: string;
  slotName: string;
  message: string;
}

interface CheckAvailabilityResponse {
  isAvailable: boolean;
  durationInWeeks: number;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  unavailableSchedules: UnavailableSchedule[];
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

  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
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
  const [isCheckingAvailability, setIsCheckingAvailability] =
    useState(false);

  const [selectedWeekdays, setSelectedWeekdays] =
    useState<string[]>(["Monday"]);

  const [selectedSlots, setSelectedSlots] =
    useState<string[]>([]);

  const [startDate, setStartDate] =
    useState("2027-01-01");

  const [slotCount, setSlotCount] =
    useState("4");

  const [paymentPlan, setPaymentPlan] =
    useState<PaymentPlan>("full");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");

  const [couponCode, setCouponCode] =
    useState("");

  const [couponApplied, setCouponApplied] =
    useState(false);

  const [couponDiscount, setCouponDiscount] =
    useState(0);

  const [bookings, setBookings] =
    useState<RecurringBooking[]>(DUMMY_BOOKINGS);

  const [alert, setAlert] = useState("");

  const [courts, setCourts] =
    useState<Court[]>([]);

  const [courtSlots, setCourtSlots] =
    useState<CourtSlot[]>([]);

  const [isLoadingCourts, setIsLoadingCourts] =
    useState(false);

  const [isLoadingSlots, setIsLoadingSlots] =
    useState(false);

  // =========================================================
  // AVAILABILITY MODAL
  // =========================================================

  const [showAvailabilityModal, setShowAvailabilityModal] =
    useState(false);

  const [availabilityResult, setAvailabilityResult] =
    useState<CheckAvailabilityResponse | null>(null);

  const [availabilityError, setAvailabilityError] =
    useState<UnavailableSchedule[]>([]);

  const occurrenceCount = useMemo(() => {
    const value = Number(slotCount);

    if (!Number.isInteger(value) || value < 1) {
      return 0;
    }

    return value;
  }, [slotCount]);

  const selectedSlotObjects = useMemo(() => {
    return courtSlots.filter((slot) =>
      selectedSlots.includes(slot.slotId),
    );
  }, [courtSlots, selectedSlots]);

  const totalOccurrences =
    occurrenceCount * selectedWeekdays.length;
  // =========================================================
  // API AMOUNTS
  // =========================================================

  const availabilityOriginalAmount =
    Number(
      availabilityResult?.originalAmount ?? 0,
    );

  const availabilityApiDiscount =
    Number(
      availabilityResult?.discountAmount ?? 0,
    );

  const availabilityApiFinalAmount =
    Number(
      availabilityResult?.finalAmount ?? 0,
    );

  const calculatedCouponDiscount =
    couponApplied
      ? couponDiscount
      : 0;

  const payableAmount =
    Math.max(
      0,
      availabilityApiFinalAmount -
      calculatedCouponDiscount,
    );

  const paymentAmount =
    paymentPlan === "full"
      ? payableAmount
      : Math.ceil(payableAmount / 2);

  const remainingAmount =
    Math.max(
      0,
      payableAmount - paymentAmount,
    );

  // =========================================================
  // SELECTED SLOT TEXT
  // =========================================================

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

  // =========================================================
  // CHECK AVAILABILITY
  // =========================================================

  const handleCheckAvailability = async () => {
    setAlert("");

    if (courts.length === 0) {
      setAlert(
        "Please select an available court.",
      );

      return;
    }

    const selectedCourtId = courts[0].id;

    if (!startDate) {
      setAlert(
        "Please select a starting date.",
      );

      return;
    }

    if (selectedWeekdays.length === 0) {
      setAlert(
        "Please select at least one booking day.",
      );

      return;
    }

    if (selectedSlots.length === 0) {
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

    try {
      setIsCheckingAvailability(true);

      /**
       * Keep the date without Z.
       *
       * This avoids PostgreSQL UTC DateTime
       * mismatch issues in the backend.
       */
      const startDateTime =
        `${startDate}T15:10:43.446`;

      const requestBody: CheckAvailabilityRequest = {
        courtId: selectedCourtId,
        startDate: startDateTime,
        numberOfSlots: occurrenceCount,
        slotIds: selectedSlots,
        daysOfWeek: selectedWeekdays,
      };

      console.log(
        "Check availability request:",
        requestBody,
      );

      const response =
        await checkAvailabilityTemp(
          requestBody,
        );

      console.log(
        "Check availability response:",
        response,
      );

      const result =
        response as CheckAvailabilityResponse;

      setAvailabilityResult(result);

      // =====================================================
      // AVAILABLE
      // =====================================================

      if (result.isAvailable === true) {
        setAvailabilityError([]);

        setPaymentPlan("full");
        setPaymentMethod("cash");

        setCouponCode("");
        setCouponApplied(false);
        setCouponDiscount(0);

        setShowAvailabilityModal(true);

        return;
      }

      // =====================================================
      // NOT AVAILABLE
      // =====================================================

      if (result.isAvailable === false) {
        setAvailabilityError(
          result.unavailableSchedules ?? [],
        );

        setShowAvailabilityModal(true);

        return;
      }

      setAlert(
        "Unable to determine booking availability.",
      );
    } catch (error: any) {
      console.error(
        "Check availability error:",
        error,
      );

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.title ||
        error?.message ||
        "Failed to check booking availability.";

      setAlert(message);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  // =========================================================
  // TOGGLE WEEKDAY
  // =========================================================

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

  // =========================================================
  // SLOT COUNT
  // =========================================================

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

    setSlotCount(
      String(numericValue),
    );
  };

  // =========================================================
  // TOGGLE SLOT
  // =========================================================

  const toggleSlot = (slotId: string) => {
    setAlert("");

    setSelectedSlots((current) => {
      if (current.includes(slotId)) {
        return current.filter(
          (id) => id !== slotId,
        );
      }

      if (current.length === 0) {
        return [slotId];
      }

      const indexes = current
        .map((id) =>
          courtSlots.findIndex(
            (slot) =>
              slot.slotId === id,
          ),
        )
        .filter(
          (index) => index >= 0,
        );

      const newIndex =
        courtSlots.findIndex(
          (slot) =>
            slot.slotId === slotId,
        );

      if (
        newIndex < 0 ||
        indexes.length === 0
      ) {
        return current;
      }

      const currentMin =
        Math.min(...indexes);

      const currentMax =
        Math.max(...indexes);

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

  // =========================================================
  // GET SLOTS
  // =========================================================

  const handleGetSlotsById = async (
    courtId: string,
  ) => {
    try {
      setIsLoadingSlots(true);
      setAlert("");

      const response =
        await getSlotByCourtId(courtId);

      console.log(
        "Slots for court:",
        courtId,
        response,
      );

      const slots =
        (response ?? []) as CourtSlot[];

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

  // =========================================================
  // GET COURTS
  // =========================================================

  const handleGetCourts = async () => {
    try {
      setIsLoadingCourts(true);
      setAlert("");

      const response =
        await getCourts();

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

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    handleGetCourts();
  }, []);

  // =========================================================
  // APPLY COUPON
  // =========================================================

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
      const calculatedDiscount =
        Math.round(
          availabilityApiFinalAmount *
          0.1,
        );

      setCouponApplied(true);
      setCouponDiscount(
        calculatedDiscount,
      );

      setAlert(
        "Coupon applied successfully.",
      );

      return;
    }

    setCouponApplied(false);
    setCouponDiscount(0);

    setAlert(
      "Invalid coupon code.",
    );
  };

  // =========================================================
  // CONFIRM BOOKING
  // =========================================================

  const handleConfirmBooking = () => {
    if (
      !availabilityResult ||
      !availabilityResult.isAvailable
    ) {
      return;
    }

    const finalAmount =
      payableAmount;

    const amountPaid =
      paymentPlan === "full"
        ? finalAmount
        : Math.ceil(
          finalAmount / 2,
        );

    const newBooking: RecurringBooking = {
      id: `SB-${String(
        bookings.length + 1,
      ).padStart(4, "0")}`,

      customerName: "Special Booking",

      phone: "0000000000",

      weekdays: [
        ...selectedWeekdays,
      ],

      time: selectedSlotTimes,

      startDate,

      endDate: `${availabilityResult.durationInWeeks} weeks`,

      occurrences:
        totalOccurrences,

      paymentPlan,

      paymentMethod,

      totalAmount:
        finalAmount,

      paidAmount:
        amountPaid,

      couponCode:
        couponApplied
          ? couponCode.toUpperCase()
          : undefined,

      status: "Confirmed",
    };

    setBookings((current) => [
      newBooking,
      ...current,
    ]);

    setShowAvailabilityModal(false);

    setCouponCode("");
    setCouponApplied(false);
    setCouponDiscount(0);

    setPaymentPlan("full");
    setPaymentMethod("cash");

    setAlert(
      "Special booking created and confirmed successfully.",
    );
  };

  const selectedCourtName =
    courts.length > 0
      ? courts[0].name
      : "No court selected";

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Special Bookings
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Register recurring badminton court
          bookings for multiple days and time slots.
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
            onClick={() =>
              setAlert("")
            }
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
                  selectedWeekdays.includes(
                    day,
                  );

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      toggleWeekday(day)
                    }
                    className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${selected
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
                      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-sm font-medium transition ${selected
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
                disabled
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
          </div> */}

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
                    {Math.ceil(
                      totalAmount / 2,
                    ).toLocaleString()}
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
              onClick={
                handleCheckAvailability
              }
              disabled={
                isCheckingAvailability
              }
              className="cursor-pointer rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCheckingAvailability
                ? "Checking..."
                : "Check Availability"}
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================
          AVAILABILITY MODAL
      ====================================================== */}

      {showAvailabilityModal &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">

              {/* =================================================
            MODAL HEADER
        ================================================== */}

              <div className="flex items-center justify-between border-b bg-white px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {availabilityResult?.isAvailable
                      ? "Booking Available"
                      : "Booking Conflict"}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {availabilityResult?.isAvailable
                      ? "Review the recurring booking and payment details."
                      : "Some selected schedules are unavailable."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowAvailabilityModal(false)
                  }
                  className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              {/* =================================================
            UNAVAILABLE
        ================================================== */}

              {!availabilityResult?.isAvailable ? (
                <div className="max-h-[calc(92vh-90px)] overflow-y-auto p-6">

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
                          Selected booking is not available
                        </p>

                        <p className="mt-1 text-sm leading-5 text-red-700">
                          One or more selected schedules
                          are already booked for the
                          requested period.
                        </p>
                      </div>

                    </div>
                  </div>

                  {/* Conflicts */}

                  <div className="space-y-3">

                    {availabilityError.length > 0 ? (
                      availabilityError.map(
                        (conflict, index) => (
                          <div
                            key={`${conflict.slotId}-${conflict.dayOfWeek}-${index}`}
                            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-4">

                              <div>
                                <p className="font-semibold text-gray-900">
                                  {conflict.dayOfWeek}
                                </p>

                                <p className="mt-1 text-sm text-gray-600">
                                  {conflict.slotName}
                                </p>
                              </div>

                              <span className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                                Unavailable
                              </span>

                            </div>

                            <div className="mt-3 border-t border-gray-100 pt-3">
                              <p className="text-sm text-red-600">
                                {conflict.message}
                              </p>
                            </div>
                          </div>
                        ),
                      )
                    ) : (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
                        The selected schedules are not
                        available for the requested period.
                      </div>
                    )}

                  </div>

                  {/* Duration */}

                  {availabilityResult && (
                    <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">

                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">

                        <div>
                          <p className="text-xs text-gray-500">
                            Court
                          </p>

                          <p className="mt-1 font-medium text-gray-900">
                            {selectedCourtName}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">
                            Duration
                          </p>

                          <p className="mt-1 font-medium text-gray-900">
                            {availabilityResult.durationInWeeks}{" "}
                            weeks
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

                    </div>
                  )}

                  {/* Footer */}

                  <div className="mt-6 flex justify-end">

                    <button
                      type="button"
                      onClick={() =>
                        setShowAvailabilityModal(false)
                      }
                      className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
                    >
                      Close
                    </button>

                  </div>

                </div>
              ) : (

                /* =================================================
                   AVAILABLE
                ================================================== */

                <div className="max-h-[calc(92vh-90px)] overflow-y-auto p-6">

                  {/* Success */}

                  <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">

                    <div className="flex items-start gap-3">

                      <div className="rounded-full bg-green-100 p-2">
                        <Check
                          size={18}
                          className="text-green-600"
                        />
                      </div>

                      <div>
                        <p className="font-semibold text-green-800">
                          All selected slots are available
                        </p>

                        <p className="mt-1 text-sm text-green-700">
                          The selected recurring schedule
                          is available. Complete the payment
                          details to confirm the booking.
                        </p>
                      </div>

                    </div>

                  </div>

                  {/* =================================================
                MAIN TWO COLUMN CONTENT
            ================================================== */}

                  <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">

                    {/* =================================================
                  LEFT SIDE - BOOKING DETAILS
              ================================================== */}

                    <div className="space-y-5">

                      {/* Booking Summary */}

                      <div className="rounded-xl border border-gray-200 bg-white p-5">

                        <h3 className="mb-5 text-sm font-semibold text-gray-900">
                          Booking Summary
                        </h3>

                        <div className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">

                          <div>
                            <p className="text-xs text-gray-500">
                              Court
                            </p>

                            <p className="mt-1.5 font-semibold text-gray-900">
                              {selectedCourtName}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">
                              Duration
                            </p>

                            <p className="mt-1.5 font-semibold text-gray-900">
                              {availabilityResult?.durationInWeeks}{" "}
                              weeks
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">
                              Starting Date
                            </p>

                            <p className="mt-1.5 font-semibold text-gray-900">
                              {startDate}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">
                              Booking Occurrences
                            </p>

                            <p className="mt-1.5 font-semibold text-gray-900">
                              {totalOccurrences}
                            </p>
                          </div>

                        </div>

                        {/* Days */}

                        <div className="mt-5 border-t border-gray-100 pt-5">

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

                        {/* Time Slots */}

                        <div className="mt-5 border-t border-gray-100 pt-5">

                          <p className="text-xs text-gray-500">
                            Selected Time Slots
                          </p>

                          <div className="mt-3 space-y-2">

                            {selectedSlotObjects.map(
                              (slot) => (
                                <div
                                  key={slot.slotId}
                                  className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
                                >

                                  <div className="flex items-center gap-2">

                                    <Clock3
                                      size={15}
                                      className="text-amber-600"
                                    />

                                    <span className="text-sm font-medium text-gray-700">
                                      {formatSlotTime(
                                        slot.startTime,
                                        slot.endTime,
                                      )}
                                    </span>

                                  </div>

                                  <span className="text-sm font-semibold text-gray-900">
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

                      </div>

                      {/* Coupon */}

                      <div className="rounded-xl border border-gray-200 bg-white p-5">

                        <label className="mb-2 block text-sm font-semibold text-gray-900">
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
                              setCouponDiscount(0);
                            }}
                            placeholder="Enter coupon code"
                            className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm uppercase outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                          />

                          <button
                            type="button"
                            onClick={handleApplyCoupon}
                            className="rounded-lg border border-amber-600 px-5 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
                          >
                            Apply
                          </button>

                        </div>

                        {couponApplied && (
                          <p className="mt-2 text-xs font-medium text-green-600">
                            Coupon applied successfully.
                          </p>
                        )}

                      </div>

                    </div>

                    {/* =================================================
                  RIGHT SIDE - PAYMENT
              ================================================== */}

                    <div className="space-y-5">

                      {/* Price */}

                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">

                        <h3 className="mb-4 text-sm font-semibold text-amber-900">
                          Payment Summary
                        </h3>

                        <div className="space-y-3">

                          <div className="flex justify-between text-sm">
                            <span className="text-amber-700">
                              Original Amount
                            </span>

                            <span className="font-medium text-amber-900">
                              Rs.{" "}
                              {availabilityOriginalAmount.toLocaleString()}
                            </span>
                          </div>

                          {(
                            availabilityApiDiscount +
                            couponDiscount
                          ) > 0 && (
                              <div className="flex justify-between text-sm">

                                <span className="text-green-700">
                                  Discount
                                </span>

                                <span className="font-medium text-green-700">
                                  - Rs.{" "}
                                  {(
                                    availabilityApiDiscount +
                                    couponDiscount
                                  ).toLocaleString()}
                                </span>

                              </div>
                            )}

                          <div className="border-t border-amber-200 pt-4">

                            <div className="flex items-center justify-between">

                              <span className="font-semibold text-amber-800">
                                Final Amount
                              </span>

                              <span className="text-2xl font-bold text-amber-900">
                                Rs.{" "}
                                {payableAmount.toLocaleString()}
                              </span>

                            </div>

                          </div>

                        </div>

                      </div>

                      {/* Payment Plan */}

                      <div className="rounded-xl border border-gray-200 bg-white p-5">

                        <label className="mb-3 block text-sm font-semibold text-gray-900">
                          Payment Plan
                        </label>

                        <div className="space-y-3">

                          {/* Full */}

                          <button
                            type="button"
                            onClick={() =>
                              setPaymentPlan("full")
                            }
                            className={`w-full rounded-xl border p-4 text-left transition ${paymentPlan === "full"
                                ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500"
                                : "border-gray-200 bg-white hover:border-gray-300"
                              }`}
                          >

                            <div className="flex items-center justify-between">

                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  Full Payment
                                </p>

                                <p className="mt-1 text-xs text-gray-500">
                                  Pay the complete amount now
                                </p>
                              </div>

                              <p className="text-sm font-bold text-amber-700">
                                Rs.{" "}
                                {payableAmount.toLocaleString()}
                              </p>

                            </div>

                          </button>

                          {/* Half */}

                          <button
                            type="button"
                            onClick={() =>
                              setPaymentPlan("installments")
                            }
                            className={`w-full rounded-xl border p-4 text-left transition ${paymentPlan === "installments"
                                ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500"
                                : "border-gray-200 bg-white hover:border-gray-300"
                              }`}
                          >

                            <div className="flex items-center justify-between">

                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  Half Payment
                                </p>

                                <p className="mt-1 text-xs text-gray-500">
                                  Pay 50% now
                                </p>
                              </div>

                              <p className="text-sm font-bold text-amber-700">
                                Rs.{" "}
                                {Math.ceil(
                                  payableAmount / 2,
                                ).toLocaleString()}
                              </p>

                            </div>

                          </button>

                        </div>

                      </div>

                      {/* Payment Amount */}

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

                        {paymentPlan === "installments" && (
                          <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">

                            <span className="text-sm text-gray-500">
                              Remaining Amount
                            </span>

                            <span className="font-semibold text-gray-700">
                              Rs.{" "}
                              {remainingAmount.toLocaleString()}
                            </span>

                          </div>
                        )}

                      </div>

                      {/* Payment Method */}

                      <div className="rounded-xl border border-gray-200 bg-white p-5">

                        <label className="mb-3 block text-sm font-semibold text-gray-900">
                          Payment Method
                        </label>

                        <div className="grid grid-cols-2 gap-3">

                          <button
                            type="button"
                            onClick={() =>
                              setPaymentMethod("cash")
                            }
                            className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${paymentMethod === "cash"
                                ? "border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-500"
                                : "border-gray-200 text-gray-600 hover:border-gray-300"
                              }`}
                          >
                            Cash
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setPaymentMethod("card")
                            }
                            className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${paymentMethod === "card"
                                ? "border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-500"
                                : "border-gray-200 text-gray-600 hover:border-gray-300"
                              }`}
                          >
                            Card
                          </button>

                        </div>

                      </div>

                    </div>

                  </div>

                  {/* =================================================
                INFO
            ================================================== */}

                  <div className="mt-6 flex items-start gap-2 rounded-xl bg-gray-50 p-4 text-xs leading-5 text-gray-500">

                    <Info
                      size={15}
                      className="mt-0.5 shrink-0"
                    />

                    <p>
                      This booking will create recurring
                      reservations for every selected day
                      for the selected duration. The selected
                      payment amount will be recorded against
                      this booking.
                    </p>

                  </div>

                  {/* =================================================
                FOOTER
            ================================================== */}

                  <div className="mt-6 flex justify-end gap-3 border-t pt-5">

                    <button
                      type="button"
                      onClick={() =>
                        setShowAvailabilityModal(false)
                      }
                      className="rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmBooking}
                      className="rounded-lg bg-gradient-to-r from-amber-500 via-amber-600 to-orange-700 px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-amber-600 hover:via-amber-700 hover:to-orange-800"
                    >
                      Confirm Booking
                    </button>

                  </div>

                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}