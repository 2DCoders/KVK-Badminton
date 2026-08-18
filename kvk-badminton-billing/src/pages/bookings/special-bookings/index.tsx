import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Info,
  X,
} from "lucide-react";

import { getCourts } from "@/services/courts-api";
import { getSlotByCourtId } from "@/services/slots-api";

import {
  checkAvailabilityTemp,
  tempBookingSlots,
} from "@/services/booking-api";
import { validateCoupon } from "@/services/offer-rate-api";
import Alert from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";

type PaymentPlan =
  | "full"
  | "installments";

type PaymentMethod =
  | "cash"
  | "card";

export interface UnavailableSchedule {
  dayOfWeek: string;
  slotId: string;
  slotName: string;
  message: string;
}

export interface CheckAvailabilityResponse {
  isAvailable: boolean;
  durationInWeeks: number;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  unavailableSchedules: UnavailableSchedule[];
}

export interface CreateSpecialBookingRequest {
  courtId: string;
  startDate: string;
  numberOfSlots: number;
  slotIds: string[];
  daysOfWeek: string[];
  memberId: string;
  couponCode: string;
  paymentType: number;
  isHalfPayment: boolean;
  amount: number;
}

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
  status:
  | "Confirmed"
  | "Conflict Review";
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

const PAYMENT_TYPE = {
  cash: 1,
  card: 2,
} as const;

const timeToMinutes = (
  time: string,
): number => {
  const [hours, minutes] =
    time.split(":").map(Number);

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

const formatTime = (
  totalMinutes: number,
): string => {
  const hours24 =
    Math.floor(totalMinutes / 60);

  const minutes =
    totalMinutes % 60;

  const period =
    hours24 >= 12 ? "PM" : "AM";

  const hours12 =
    hours24 % 12 || 12;

  return `${hours12}:${String(
    minutes,
  ).padStart(2, "0")} ${period}`;
};

const formatSlotTime = (
  startTime: string,
  endTime: string,
): string => {
  return `${formatTime(
    timeToMinutes(startTime),
  )} - ${formatTime(
    timeToMinutes(endTime),
  )}`;
};

export default function SpecialBookingsPage() {
  const [customerName, setCustomerName] =
    useState("");

  const [phoneNumber, setPhoneNumber] =
    useState("");

  const [memberId, setMemberId] =
    useState("");

  const [
    isCheckingAvailability,
    setIsCheckingAvailability,
  ] = useState(false);

  const [
    isCreatingBooking,
    setIsCreatingBooking,
  ] = useState(false);
  const [pageAlert, setPageAlert] = useState<{
    visible: boolean;
    variant?: "success" | "error" | "warning" | "info";
    title?: string;
    description?: string;
  }>({ visible: false });

  const [
    isValidatingCoupon,
    setIsValidatingCoupon,
  ] = useState(false);

  const [
    selectedWeekdays,
    setSelectedWeekdays,
  ] = useState<string[]>([
    "Monday",
  ]);

  const [
    selectedSlots,
    setSelectedSlots,
  ] = useState<string[]>([]);

  const [
    startDate,
    setStartDate,
  ] = useState("2027-01-01");

  const [
    slotCount,
    setSlotCount,
  ] = useState("4");

  const [
    paymentPlan,
    setPaymentPlan,
  ] = useState<PaymentPlan>("full");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<PaymentMethod>("cash");

  const [couponCode, setCouponCode] =
    useState("");

  const [
    couponApplied,
    setCouponApplied,
  ] = useState(false);

  const [
    couponDiscount,
    setCouponDiscount,
  ] = useState(0);

  const [
    showAvailabilityModal,
    setShowAvailabilityModal,
  ] = useState(false);

  const [
    availabilityResult,
    setAvailabilityResult,
  ] =
    useState<CheckAvailabilityResponse | null>(
      null,
    );

  const [
    availabilityError,
    setAvailabilityError,
  ] = useState<UnavailableSchedule[]>(
    [],
  );

  const [bookings, setBookings] =
    useState<RecurringBooking[]>(
      [],
    );

  const [alert, setAlert] =
    useState("");

  const [courts, setCourts] =
    useState<Court[]>([]);

  const [courtSlots, setCourtSlots] =
    useState<CourtSlot[]>([]);

  const [
    isLoadingCourts,
    setIsLoadingCourts,
  ] = useState(false);

  const [
    isLoadingSlots,
    setIsLoadingSlots,
  ] = useState(false);

  const navigate = useNavigate();

  const dayendData = localStorage.getItem("dayEndData") ? JSON.parse(localStorage.getItem("dayEndData") as string) : null;

  useEffect(() => {
    if (!dayendData) {
      navigate("/dayend");
    }
  }, [dayendData]);

  const occurrenceCount =
    useMemo(() => {
      const value = Number(slotCount);

      if (
        !Number.isInteger(value) ||
        value < 1
      ) {
        return 0;
      }

      return value;
    }, [slotCount]);

  const selectedSlotObjects =
    useMemo(() => {
      return courtSlots.filter((slot) =>
        selectedSlots.includes(
          slot.slotId,
        ),
      );
    }, [
      courtSlots,
      selectedSlots,
    ]);

  const totalOccurrences =
    occurrenceCount *
    selectedWeekdays.length;

  const selectedSlotTimes =
    useMemo(() => {
      return selectedSlotObjects
        .map((slot) =>
          formatSlotTime(
            slot.startTime,
            slot.endTime,
          ),
        )
        .join(", ");
    }, [selectedSlotObjects]);

  /*
   * API availability amount.
   */
  const availabilityOriginalAmount =
    Number(
      availabilityResult?.originalAmount ??
      0,
    );

  const availabilityApiDiscount =
    Number(
      availabilityResult?.discountAmount ??
      0,
    );

  /*
   * Coupon discount is applied on top
   * of the availability API discount.
   */
  const totalDiscount =
    availabilityApiDiscount +
    couponDiscount;

  const payableAmount = Math.max(
    0,
    availabilityOriginalAmount -
    totalDiscount,
  );

  const paymentAmount =
    paymentPlan === "installments"
      ? Math.ceil(payableAmount / 2)
      : payableAmount;

  const remainingAmount =
    Math.max(
      0,
      payableAmount - paymentAmount,
    );

  const selectedCourtName =
    courts.length > 0
      ? courts[0].name
      : "No court selected";

  /*
   * ---------------------------------------------
   * Toggle weekday
   * ---------------------------------------------
   */
  const toggleWeekday = (
    day: string,
  ) => {
    setSelectedWeekdays((current) => {
      if (current.includes(day)) {
        if (current.length === 1) {
          setPageAlert({
            visible: true,
            variant: "error",
            title: "Invalid Selection",
            description: "At least one day must be selected.",
          });

          return current;
        }

        return current.filter(
          (item) => item !== day,
        );
      }

      return [...current, day];
    });
  };

  /*
   * ---------------------------------------------
   * Slot count
   * ---------------------------------------------
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

    const numericValue =
      Number(value);

    if (
      !Number.isSafeInteger(
        numericValue,
      )
    ) {
      return;
    }

    if (numericValue < 1) {
      return;
    }

    setSlotCount(
      String(numericValue),
    );
  };

  /*
   * ---------------------------------------------
   * Slot selection
   * ---------------------------------------------
   */
  const toggleSlot = (
    slotId: string,
  ) => {
    setPageAlert((s) => ({ ...s, visible: false }));

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
        newIndex ===
        currentMin - 1 ||
        newIndex ===
        currentMax + 1
      ) {
        return [
          ...current,
          slotId,
        ].sort((a, b) => {
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
        });
      }

      setPageAlert({
        visible: true,
        variant: "error",
        title: "Invalid Selection",
        description: "Only consecutive time slots can be selected.",
      });

      return current;
    });
  };

  /*
   * ---------------------------------------------
   * Fetch slots
   * ---------------------------------------------
   */
  const handleGetSlotsById =
    async (courtId: string) => {
      try {
        setIsLoadingSlots(true);
        setPageAlert((s) => ({ ...s, visible: false }));

        const response =
          await getSlotByCourtId(
            courtId,
          );

        const slots =
          (response ??
            []) as CourtSlot[];

        if (
          !Array.isArray(slots) ||
          slots.length === 0
        ) {
          setCourtSlots([]);
          setSelectedSlots([]);

          setPageAlert({
            visible: true,
            variant: "error",
            title: "No Slots Available",
            description: "No booking slots found for this court.",
          });

          return;
        }

        const validSlots =
          slots
            .filter(
              (slot) =>
                slot.courtId ===
                courtId &&
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

        setCourtSlots(
          validSlots,
        );

        setSelectedSlots(
          validSlots.length > 0
            ? [validSlots[0].slotId]
            : [],
        );
      } catch (error) {
        console.error(
          "Error fetching slots:",
          error,
        );

        setCourtSlots([]);
        setSelectedSlots([]);

        setPageAlert({
          visible: true,
          variant: "error",
          title: "Failed to Fetch Slots",
          description: "Failed to fetch slots. Please try again later.",
        });
      } finally {
        setIsLoadingSlots(false);
      }
    };

  /*
   * ---------------------------------------------
   * Fetch courts
   * ---------------------------------------------
   */
  const handleGetCourts =
    async () => {
      try {
        setIsLoadingCourts(true);
        setPageAlert((s) => ({ ...s, visible: false }));

        const response =
          await getCourts();

        const courtList =
          (response ??
            []) as Court[];

        setCourts(courtList);

        if (
          courtList.length > 0
        ) {
          await handleGetSlotsById(
            courtList[0].id,
          );
        } else {
          setCourtSlots([]);
          setSelectedSlots([]);

          setPageAlert({
            visible: true,
            variant: "error",
            title: "No Courts Available",
            description: "No badminton courts are available.",
          });
        }
      } catch (error) {
        console.error(
          "Error fetching courts:",
          error,
        );

        setCourts([]);
        setCourtSlots([]);
        setSelectedSlots([]);

        setPageAlert({
          visible: true,
          variant: "error",
          title: "Failed to Fetch Courts",
          description: "Failed to fetch courts. Please try again later.",
        });
      } finally {
        setIsLoadingCourts(false);
      }
    };

  useEffect(() => {
    handleGetCourts();
  }, []);

  /*
   * ---------------------------------------------
   * Check availability
   * ---------------------------------------------
   */
  const handleCheckAvailability =
    async () => {
      setPageAlert((s) => ({ ...s, visible: false }));

      if (courts.length === 0) {
        setPageAlert({
          visible: true,
          variant: "error",
          title: "No Courts Available",
          description: "Please select an available court.",
        });

        return;
      }

      const selectedCourtId =
        courts[0].id;

      if (!startDate) {
        setPageAlert({
          visible: true,
          variant: "error",
          title: "Invalid Date Selection",
          description: "Please select a starting date.",
        });

        return;
      }

      if (
        selectedWeekdays.length ===
        0
      ) {
        setPageAlert({
          visible: true,
          variant: "error",
          title: "Invalid Weekday Selection",
          description: "Please select at least one booking day.",
        });

        return;
      }

      if (
        selectedSlots.length === 0
      ) {
        setPageAlert({
          visible: true,
          variant: "error",
          title: "Invalid Time Slot Selection",
          description: "Please select at least one time slot.",
        });

        return;
      }

      if (occurrenceCount < 1) {
        setPageAlert({
          visible: true,
          variant: "error",
          title: "Invalid Occurrence Count",
          description: "Please enter a valid number of weeks.",
        });

        return;
      }

      try {
        setIsCheckingAvailability(
          true,
        );

        setAvailabilityResult(
          null,
        );

        setAvailabilityError([]);

        /*
         * IMPORTANT:
         *
         * Do not add Z here.
         *
         * PostgreSQL backend expects the
         * datetime without UTC suffix.
         */
        const startDateTime =
          `${startDate}T00:00:00`;

        const requestBody = {
          courtId:
            selectedCourtId,

          startDate:
            startDateTime,

          numberOfSlots:
            occurrenceCount,

          slotIds:
            selectedSlots,

          daysOfWeek:
            selectedWeekdays,

          memberId: ''
        };

        const response =
          await checkAvailabilityTemp(
            requestBody,
          );

        setAvailabilityResult(
          response,
        );

        setAvailabilityError(
          response?.unavailableSchedules ??
          [],
        );

        /*
         * Open modal for BOTH cases.
         */
        setShowAvailabilityModal(
          true,
        );
      } catch (error: any) {

        const message =
          error?.response?.data
            ?.message ||
          error?.response?.data
            ?.title ||
          error?.response?.data
            ?.error ||
          error?.message ||
          "Failed to check booking availability.";

        setPageAlert({
          visible: true,
          variant: "error",
          title: "Failed to Check Availability",
          description: message,
        });
      } finally {
        setIsCheckingAvailability(
          false,
        );
      }
    };

  /*
   * ---------------------------------------------
   * Apply coupon
   * ---------------------------------------------
   */
  const handleApplyCoupon =
    async () => {
      const code =
        couponCode
          .trim()
          .toUpperCase();

      if (!code) {
        setPageAlert({
          visible: true,
          variant: "error",
          title: "Invalid Coupon Code",
          description: "Please enter a coupon code.",
        });

        return;
      }

      if (
        !availabilityResult?.isAvailable
      ) {
        setPageAlert({
          visible: true,
          variant: "error",
          title: "Unavailable Booking",
          description: "Booking availability must be confirmed before applying a coupon.",
        });

        return;
      }

      try {
        setIsValidatingCoupon(
          true,
        );

        setPageAlert({
          visible: false,
        });

        const response =
          await validateCoupon(
            code,
            availabilityOriginalAmount.toString(),
            selectedSlots.length * availabilityResult.durationInWeeks * selectedWeekdays.length,
          );

        if (
          response?.isValid ===
          true
        ) {
          const discount =
            Number(
              response.discountAmount ??
              0,
            );

          setCouponApplied(
            true,
          );

          setCouponDiscount(
            discount,
          );

          setPageAlert({
            visible: true,
            variant: "success",
            title: "Coupon Applied",
            description: `Coupon applied successfully. Discount: Rs. ${discount.toLocaleString()}`,
          });
        } else {
          setCouponApplied(
            false,
          );

          setCouponDiscount(0);

          setPageAlert({
            visible: true,
            variant: "error",
            title: "Invalid Coupon Code",
            description: "The coupon code is invalid or not applicable.",
          });
        }
      } catch (error: any) {

        setCouponApplied(
          false,
        );

        setCouponDiscount(0);

        const message =
          error?.response?.data
            ?.error ||
          error?.response?.data
            ?.message ||
          error?.response?.data
            ?.errorMessage ||
          "Invalid coupon code.";

        setPageAlert({
          visible: true,
          variant: "error",
          title: "Invalid Coupon Code",
          description: message,
        });
      } finally {
        setIsValidatingCoupon(
          false,
        );
      }
    };

  /*
   * ---------------------------------------------
   * Confirm booking
   * ---------------------------------------------
   */
  const handleConfirmBooking =
    async () => {
      setPageAlert({
        visible: false,
      });

      if (
        !availabilityResult?.isAvailable
      ) {
        setPageAlert({
          visible: true,
          variant: "error",
          title: "Unavailable Booking",
          description: "The booking is not available.",
        });

        return;
      }

      if (!memberId.trim()) {
        setPageAlert({
          visible: true,
          variant: "error",
          title: "Invalid Member ID",
          description: "Please enter a valid Member ID.",
        });

        return;
      }

      if (
        selectedWeekdays.length ===
        0
      ) {
        setPageAlert({
          visible: true,
          variant: "error",
          title: "Invalid Booking Selection",
          description: "Please select at least one booking day.",
        });

        return;
      }

      if (
        selectedSlots.length === 0
      ) {
        setPageAlert({
          visible: true,
          variant: "error",
          title: "Invalid Time Slot Selection",
          description: "Please select at least one time slot.",
        });

        return;
      }

      if (
        occurrenceCount < 1
      ) {
        setPageAlert({
          visible: true,
          variant: "error",
          title: "Invalid Duration",
          description: "Please enter a valid duration.",
        });

        return;
      }

      if (payableAmount <= 0) {
        setPageAlert({
          visible: true,
          variant: "error",
          title: "Invalid Payment Amount",
          description: "Payment amount must be greater than zero.",
        });

        return;
      }

      try {
        setIsCreatingBooking(
          true,
        );

        const selectedCourtId =
          courts[0]?.id;

        if (!selectedCourtId) {
          setPageAlert({
            visible: true,
            variant: "error",
            title: "No Court Selected",
            description: "Please select a court.",
          });

          return;
        }

        /*
         * IMPORTANT:
         *
         * Backend request body.
         */
        const requestBody = {
          courtId:
            selectedCourtId,

          startDate:
            `${startDate}T00:00:00`,

          numberOfSlots:
            occurrenceCount,

          slotIds:
            selectedSlots,

          daysOfWeek:
            selectedWeekdays,

          memberId:
            "KVK-MEM-2026" + memberId.trim(),

          couponCode:
            couponApplied
              ? couponCode
                .trim()
                .toUpperCase()
              : "",

          paymentType:
            PAYMENT_TYPE[
            paymentMethod
            ],

          isHalfPayment:
            paymentPlan ===
            "installments",

          amount:
            paymentAmount,
        };

        const response =
          await tempBookingSlots(
            requestBody,
          );

        console.log(
          "Create special booking response:",
          response,
        );

        /*
         * Add local record.
         */
        const newBooking: RecurringBooking =
        {
          id: `SB-${String(
            bookings.length + 1,
          ).padStart(4, "0")}`,

          customerName,

          phone:
            phoneNumber,

          weekdays: [
            ...selectedWeekdays,
          ],

          time:
            selectedSlotTimes,

          startDate,

          endDate:
            `${occurrenceCount} weeks`,

          occurrences:
            totalOccurrences,

          paymentPlan,

          paymentMethod,

          totalAmount:
            payableAmount,

          paidAmount:
            availabilityOriginalAmount,

          couponCode:
            couponApplied
              ? couponCode
                .trim()
                .toUpperCase()
              : undefined,

          status:
            "Confirmed",
        };

        setBookings(
          (current) => [
            newBooking,
            ...current,
          ],
        );

        setShowAvailabilityModal(
          false,
        );

        setAvailabilityResult(
          null,
        );

        setAvailabilityError(
          [],
        );

        setCustomerName("");
        setPhoneNumber("");
        setMemberId("");

        setCouponCode("");
        setCouponApplied(
          false,
        );
        setCouponDiscount(0);

        setPaymentPlan("full");
        setPaymentMethod(
          "cash",
        );

        setSelectedWeekdays([
          "Monday",
        ]);

        setSelectedSlots(
          courtSlots.length > 0
            ? [
              courtSlots[0]
                .slotId,
            ]
            : [],
        );

        setSlotCount("4");

        setPageAlert({
          visible: true,
          variant: "success",
          title: "Special Booking Created",
          description: "Special booking created successfully.",
        });
      } catch (error: any) {
        console.error(
          "Create special booking error:",
          error,
        );

        const message =
          error?.response?.data
            ?.message ||
          error?.response?.data
            ?.title ||
          error?.response?.data
            ?.error ||
          error?.message ||
          "Failed to create special booking.";

        setPageAlert({
          visible: true,
          variant: "error",
          title: "Failed to Create Special Booking",
          description: message,
        });
      } finally {
        setIsCreatingBooking(
          false,
        );
      }
    };

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {pageAlert.visible && createPortal(
        <div>
          <Alert
            variant={pageAlert.variant as any}
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

      {/* =================================================
          FORM
      ================================================== */}

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
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
              Number of Slots
              (Duration)
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
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500"
            />

            <p className="mt-1.5 text-xs text-gray-500">
              Number of recurring weeks.
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
              isCheckingAvailability
            }
            className="cursor-pointer rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCheckingAvailability
              ? "Checking..."
              : "Check Availability"}
          </button>
        </div>
      </div>

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
                  onClick={() => {
                    setShowAvailabilityModal(
                      false,
                    )
                    setAvailabilityResult(null)
                    setAvailabilityError([])
                    setCouponCode("")
                    setCouponApplied(false)
                    setCouponDiscount(0)
                  }
                  }
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
                              key={`${conflict.slotId}-${conflict.dayOfWeek}-${index}`}
                              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {
                                      conflict.dayOfWeek
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

                            setCouponApplied(
                              false,
                            );

                            setCouponDiscount(
                              0,
                            );
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

                    {/* PAYMENT PLAN */}

                    <div className="rounded-xl border border-gray-200 p-5">
                      <label className="mb-3 block text-sm font-medium text-gray-700">
                        Payment Plan
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setPaymentPlan(
                              "full",
                            )
                          }
                          className={`rounded-xl border p-4 text-left transition ${paymentPlan ===
                            "full"
                            ? "border-amber-500 bg-amber-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                        >
                          <p className="text-sm font-semibold text-gray-900">
                            Full Payment
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            Pay the complete
                            amount now
                          </p>

                          <p className="mt-3 text-base font-bold text-amber-700">
                            Rs.{" "}
                            {payableAmount.toLocaleString()}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setPaymentPlan(
                              "installments",
                            )
                          }
                          className={`rounded-xl border p-4 text-left transition ${paymentPlan ===
                            "installments"
                            ? "border-amber-500 bg-amber-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                        >
                          <p className="text-sm font-semibold text-gray-900">
                            Half Payment
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            Pay 50% now
                          </p>

                          <p className="mt-3 text-base font-bold text-amber-700">
                            Rs.{" "}
                            {Math.ceil(
                              payableAmount /
                              2,
                            ).toLocaleString()}
                          </p>
                        </button>
                      </div>
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

                      {paymentPlan ===
                        "installments" && (
                          <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-sm">
                            <span className="text-gray-500">
                              Remaining Amount
                            </span>

                            <span className="font-semibold text-gray-700">
                              Rs.{" "}
                              {remainingAmount.toLocaleString()}
                            </span>
                          </div>
                        )}
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

                    <div className="rounded-xl border border-gray-200 p-5">
                      {/* MEMBER ID */}

                      <div className="mb-5">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Member ID
                        </label>

                        <div className="flex">
                          <div className="w-[200px] flex items-center rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-600">
                            KVK-MEM-2026
                          </div>

                          <input
                            type="text"
                            value={memberId}
                            maxLength={4}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            onChange={(e) => {
                              const value = e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 4);

                              setMemberId(value);
                            }}
                            placeholder="XXXX"
                            className="w-full rounded-r-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500"
                          />
                        </div>

                        <p className="mt-1.5 text-xs text-gray-500">
                          Enter the last 4 digits of the member ID.
                          Example: <span className="font-medium">1234</span>
                        </p>
                      </div>
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
                  </div>
                )}
              </div>

              {/* FOOTER */}

              {availabilityResult?.isAvailable && (
                <div className="flex shrink-0 justify-end gap-3 border-t bg-gray-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={() =>
                      setShowAvailabilityModal(
                        false,
                      )
                    }
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
                      isCreatingBooking || !memberId
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