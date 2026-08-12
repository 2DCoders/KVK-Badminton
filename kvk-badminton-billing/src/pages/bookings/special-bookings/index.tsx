import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  Info,
  X,
} from "lucide-react";

import { getCourts } from "@/services/courts-api";
import { getSlotById } from "@/services/slots-api";

type PaymentPlan = "full" | "installments";
type PaymentMethod = "cash" | "card";

interface RecurringBooking {
  id: string;
  customerName: string;
  phone: string;
  weekday: string;
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

interface CourtSlotConfiguration {
  id: string;
  courtId: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  slotGapMinutes: number;
  isActive: number;
  createdAt: string;
  lastModifiedAt: string;
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

const SLOT_PRICE = 1500;

const DUMMY_BOOKINGS: RecurringBooking[] = [
  {
    id: "SB-0001",
    customerName: "Kasun Perera",
    phone: "0771234567",
    weekday: "Monday",
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
    weekday: "Wednesday",
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
    weekday: "Monday",
    time: "5:00 PM - 6:00 PM",
    startDate: "2026-10-05",
    endDate: "2027-03-29",
    occurrences: 26,
    paymentPlan: "full",
    paymentMethod: "cash",
    totalAmount: 39000,
    paidAmount: 39000,
    status: "Conflict Review",
  },
];

/**
 * Converts "08:00:00" into minutes from midnight.
 */
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

/**
 * Converts minutes from midnight into readable 12-hour time.
 */
const formatTime = (totalMinutes: number): string => {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;

  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
};

/**
 * Generates booking slots from backend configuration.
 */
const generateTimeSlots = (
  startTime: string,
  endTime: string,
  slotDurationMinutes: number,
  slotGapMinutes: number,
): string[] => {
  const slots: string[] = [];

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (slotDurationMinutes <= 0) {
    return slots;
  }

  if (endMinutes <= startMinutes) {
    return slots;
  }

  let currentMinutes = startMinutes;

  while (currentMinutes + slotDurationMinutes <= endMinutes) {
    const slotStart = formatTime(currentMinutes);
    const slotEnd = formatTime(
      currentMinutes + slotDurationMinutes,
    );

    slots.push(`${slotStart} - ${slotEnd}`);

    currentMinutes +=
      slotDurationMinutes + Math.max(0, slotGapMinutes);
  }

  return slots;
};

export default function SpecialBookingsPage() {
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [weekday, setWeekday] = useState("Monday");

  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  const [startDate, setStartDate] = useState("2026-09-07");

  /**
   * Number of recurring occurrences.
   *
   * Only positive whole numbers are allowed.
   */
  const [slotCount, setSlotCount] = useState("1");

  const [paymentPlan, setPaymentPlan] =
    useState<PaymentPlan>("full");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);

  const [showConfirmModal, setShowConfirmModal] =
    useState(false);

  const [bookings, setBookings] =
    useState<RecurringBooking[]>(DUMMY_BOOKINGS);

  const [alert, setAlert] = useState("");

  const [courts, setCourts] = useState<Court[]>([]);

  const [slotConfiguration, setSlotConfiguration] =
    useState<CourtSlotConfiguration | null>(null);

  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  const [isLoadingCourts, setIsLoadingCourts] =
    useState(false);

  const [isLoadingSlots, setIsLoadingSlots] =
    useState(false);

  /**
   * Convert entered slot count into a safe positive integer.
   */
  const occurrenceCount = useMemo(() => {
    const value = Number(slotCount);

    if (!Number.isInteger(value) || value < 1) {
      return 0;
    }

    return value;
  }, [slotCount]);

  const totalSlots =
    selectedSlots.length * occurrenceCount;

  const subtotal = totalSlots * SLOT_PRICE;

  const discount = couponApplied
    ? Math.round(subtotal * 0.1)
    : 0;

  const totalAmount = subtotal - discount;

  const installmentAmount = Math.ceil(totalAmount / 2);

  /**
   * Handles number input.
   *
   * Only positive whole numbers are accepted.
   * Negative numbers, decimals and other characters
   * are rejected.
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
   * Toggle a generated slot.
   *
   * Only consecutive slots can be selected.
   */
  const toggleSlot = (slot: string) => {
    setSelectedSlots((current) => {
      if (current.includes(slot)) {
        return current.filter((item) => item !== slot);
      }

      if (current.length === 0) {
        return [slot];
      }

      const indexes = current
        .map((item) => timeSlots.indexOf(item))
        .filter((index) => index >= 0);

      const newIndex = timeSlots.indexOf(slot);

      if (newIndex < 0 || indexes.length === 0) {
        return current;
      }

      const currentMin = Math.min(...indexes);
      const currentMax = Math.max(...indexes);

      /**
       * Only allow adding the slot immediately before
       * or immediately after the current selection.
       */
      if (
        newIndex === currentMin - 1 ||
        newIndex === currentMax + 1
      ) {
        return [...current, slot].sort(
          (a, b) =>
            timeSlots.indexOf(a) -
            timeSlots.indexOf(b),
        );
      }

      return current;
    });
  };

  /**
   * Fetch all courts.
   */
  const handleGetCourts = async () => {
    try {
      setIsLoadingCourts(true);

      const response = await getCourts();

      const courtList = (response ?? []) as Court[];

      setCourts(courtList);

      if (courtList.length > 0) {
        await handleGetSlotsById(courtList[0].id);
      } else {
        setSlotConfiguration(null);
        setTimeSlots([]);
        setSelectedSlots([]);

        setAlert(
          "No badminton courts are available.",
        );
      }
    } catch (error) {
      console.error("Error fetching courts:", error);

      setCourts([]);
      setSlotConfiguration(null);
      setTimeSlots([]);
      setSelectedSlots([]);

      setAlert(
        "Failed to fetch courts. Please try again later.",
      );
    } finally {
      setIsLoadingCourts(false);
    }
  };

  /**
   * Fetch slot configuration for a court.
   */
  const handleGetSlotsById = async (
    courtId: string,
  ) => {
    try {
      setIsLoadingSlots(true);

      const response = await getSlotById(courtId);

      console.log(
        "Slot configuration for court",
        courtId,
        ":",
        response,
      );

      if (!response) {
        setSlotConfiguration(null);
        setTimeSlots([]);
        setSelectedSlots([]);

        setAlert(
          "No slot configuration found for this court.",
        );

        return;
      }

      const configuration =
        response as CourtSlotConfiguration;

      setSlotConfiguration(configuration);

      if (configuration.isActive !== 1) {
        setTimeSlots([]);
        setSelectedSlots([]);

        setAlert(
          "This court is currently inactive.",
        );

        return;
      }

      if (
        !configuration.startTime ||
        !configuration.endTime ||
        configuration.slotDurationMinutes <= 0
      ) {
        setTimeSlots([]);
        setSelectedSlots([]);

        setAlert(
          "Invalid slot configuration received from the server.",
        );

        return;
      }

      const generatedSlots = generateTimeSlots(
        configuration.startTime,
        configuration.endTime,
        configuration.slotDurationMinutes,
        configuration.slotGapMinutes,
      );

      console.log(
        "Generated time slots:",
        generatedSlots,
      );

      setTimeSlots(generatedSlots);

      setSelectedSlots(
        generatedSlots.length > 0
          ? [generatedSlots[0]]
          : [],
      );

      if (generatedSlots.length === 0) {
        setAlert(
          "No valid booking slots can be generated from the court configuration.",
        );
      }
    } catch (error) {
      console.error("Error fetching slots:", error);

      setSlotConfiguration(null);
      setTimeSlots([]);
      setSelectedSlots([]);

      setAlert(
        "Failed to fetch slots. Please try again later.",
      );
    } finally {
      setIsLoadingSlots(false);
    }
  };

  useEffect(() => {
    handleGetCourts();
  }, []);

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      setAlert("Please enter a coupon code.");
      return;
    }

    if (
      couponCode.trim().toUpperCase() === "KVK10"
    ) {
      setCouponApplied(true);
      setAlert("Coupon applied successfully.");
    } else {
      setCouponApplied(false);
      setAlert("Invalid coupon code.");
    }
  };

  const handleCreateBooking = () => {
    if (!customerName.trim() || !phoneNumber.trim()) {
      setAlert(
        "Please enter customer name and phone number.",
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
        "Please enter a valid number of slots.",
      );
      return;
    }

    if (timeSlots.length === 0) {
      setAlert(
        "No valid time slots are available.",
      );
      return;
    }

    if (!courts.length) {
      setAlert(
        "Please select an available court.",
      );
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmBooking = () => {
    const newBooking: RecurringBooking = {
      id: `SB-${String(
        bookings.length + 1,
      ).padStart(4, "0")}`,

      customerName,

      phone: phoneNumber,

      weekday,

      time: selectedSlots.join(", "),

      startDate,

      endDate: `${occurrenceCount} occurrences`,

      occurrences: occurrenceCount,

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

    setCustomerName("");
    setPhoneNumber("");

    setSelectedSlots(
      timeSlots.length > 0
        ? [timeSlots[0]]
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
      : "Select a court";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Special Bookings
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Register recurring badminton court bookings
          for future dates.
        </p>
      </div>

      {/* Alert */}
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

      <div className="grid gap-6 lg:grid-cols-1">
        {/* LEFT */}
        <div className="space-y-6">
          {/* Recurring Schedule */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-5 flex items-center gap-2">
              <CalendarDays size={18} />

              <div>
                <h2 className="font-semibold text-gray-900">
                  Recurring Schedule
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Select when the customer wants to play.
                </p>
              </div>
            </div>

            {/* Court */}
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
                      Currently available for special
                      booking registration
                    </p>
                  </div>

                  <Check
                    size={19}
                    className="text-amber-600"
                  />
                </div>
              </div>
            </div>

            {/* Weekday */}
            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Every
              </label>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setWeekday(day)}
                    className={`cursor-pointer rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                      weekday === day
                        ? "border-amber-500 bg-amber-50 text-amber-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Slots */}
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
              ) : timeSlots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                  <Clock3
                    size={20}
                    className="mx-auto mb-2 text-gray-400"
                  />

                  <p className="text-sm font-medium text-gray-600">
                    No time slots available
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    The selected court has no active slot
                    configuration.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {timeSlots.map((slot) => {
                    const selected =
                      selectedSlots.includes(slot);

                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() =>
                          toggleSlot(slot)
                        }
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                          selected
                            ? "border-amber-500 bg-amber-50 text-amber-700"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <Clock3 size={15} />

                        {slot}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Date + Number of Slots */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Starting Date
                </label>

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) =>
                    setStartDate(e.target.value)
                  }
                  className="mt-1.5 w-full cursor-pointer rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Number of Slots (4 slots = 1 month)
                </label>

                <input
                  type="number"
                  min={1}
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
                  Enter the number of recurring slots (4 slots = 1 month).
                </p>
              </div>
            </div>

            {/* Check Availability */}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (occurrenceCount < 1) {
                    setAlert(
                      "Please enter a valid number of slots.",
                    );
                    return;
                  }

                  setAlert(
                    "Availability check completed.",
                  );
                }}
                className="cursor-pointer rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                Check Availability
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Confirm Special Booking
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Review the recurring booking details.
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

            {/* Modal Body */}
            <div className="space-y-4 p-5">
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
                      Schedule
                    </p>

                    <p className="mt-1 font-medium">
                      Every {weekday}
                    </p>
                  </div>

                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">
                      Time
                    </p>

                    <p className="mt-1 font-medium">
                      {selectedSlots.join(", ")}
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

                  <div>
                    <p className="text-xs text-gray-500">
                      Number of Slots (4 slots = 1 month)
                    </p>

                    <p className="mt-1 font-medium">
                      {occurrenceCount}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Total Selected Slots (4 slots = 1 month)
                    </p>

                    <p className="mt-1 font-medium">
                      {totalSlots}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex justify-between">
                  <span className="text-sm text-amber-700">
                    Total Amount
                  </span>

                  <span className="font-bold text-amber-800">
                    Rs.{" "}
                    {totalAmount.toLocaleString()}
                  </span>
                </div>

                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-amber-700">
                    Payment
                  </span>

                  <span className="font-medium capitalize text-amber-800">
                    {paymentPlan} / {paymentMethod}
                  </span>
                </div>

                {paymentPlan === "installments" && (
                  <div className="mt-2 flex justify-between border-t border-amber-200 pt-2 text-sm">
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

              <div className="flex items-start gap-2 text-xs leading-5 text-gray-500">
                <Info
                  size={15}
                  className="mt-0.5 shrink-0"
                />

                <p>
                  Once the payment is recorded, this
                  special booking will be automatically
                  confirmed. Any future slot conflicts will
                  be highlighted for review.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
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