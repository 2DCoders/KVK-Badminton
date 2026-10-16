import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Clock3, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getMemberBookingSetup, getCashierAvailability, bookingError } from "@/services/special-bookings-api";
import { getEnv } from "@/env";
import { isDate, maximumWeeks, sriLankaToday } from "../booking-utils";
import Alert from "@/components/ui/alert";

interface Court {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface AvailabilitySlot {
  date: string;
  availableSlotId: string;
  availableSlotName: string;
}

interface AvailabilityDay {
  dayOfWeekName: string;
  dayOfWeekDetails: AvailabilitySlot[];
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

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDayDate = (dateString: string): string => {
  const date = new Date(dateString);

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
};

export default function SpecialBookingsAvailability() {
  const navigate = useNavigate();
  const env = getEnv();
  const today = sriLankaToday();
  const startDate = isDate(env.BADMINTON_BOOKING_START_DATE) && env.BADMINTON_BOOKING_START_DATE > today ? env.BADMINTON_BOOKING_START_DATE : today;
  const [maximumDuration, setMaximumDuration] = useState(52);

  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState("");

  const [selectedDay, setSelectedDay] =
    useState<string>("Monday");

  const [selectedPeriod, setSelectedPeriod] =
    useState<number>(1);

  const [availability, setAvailability] =
    useState<AvailabilityDay[]>([]);

  const [isLoadingCourts, setIsLoadingCourts] =
    useState(false);

  const [isCheckingAvailability, setIsCheckingAvailability] =
    useState(false);

  const [pageAlert, setPageAlert] = useState<{
    visible: boolean;
    variant?: "success" | "error" | "warning" | "info";
    title?: string;
    description?: string;
  }>({
    visible: false,
  });

  const selectedCourt = useMemo(() => {
    return courts.find(
      (court) => court.id === selectedCourtId,
    );
  }, [courts, selectedCourtId]);

  const periodOptions = Array.from({ length: maximumDuration }, (_, index) => ({ weeks: index + 1, label: `${index + 1} ${index === 0 ? "Week" : "Weeks"}` }));
  const selectedPeriodData = periodOptions.find(period => period.weeks === selectedPeriod) ?? periodOptions[0];

  /*
   * ----------------------------------------------------
   * Fetch courts
   * ----------------------------------------------------
   */
  useEffect(() => {
    const loadCourts = async () => {
      try {
        setIsLoadingCourts(true);

        const response = await getMemberBookingSetup();
        setMaximumDuration(Math.min(response.maximumWeeks, maximumWeeks(env.BOOKING_DURATION) || 52));
        const courtList = [response.court] as Court[];

        setCourts(courtList);

        if (courtList.length > 0) {
          setSelectedCourtId(courtList[0].id);
        } else {
          setPageAlert({
            visible: true,
            variant: "error",
            title: "No Courts Available",
            description:
              "No badminton courts are available.",
          });
        }
      } catch (error) {
        console.error(
          "Error fetching courts:",
          error,
        );

        setPageAlert({
          visible: true,
          variant: "error",
          title: "Failed to Fetch Courts",
          description:
            "Failed to fetch courts. Please try again later.",
        });
      } finally {
        setIsLoadingCourts(false);
      }
    };

    loadCourts();
  }, [env.BOOKING_DURATION]);

  /*
   * ----------------------------------------------------
   * Select weekday
   *
   * Only ONE weekday can be selected.
   * ----------------------------------------------------
   */
  const handleDaySelect = (day: string) => {
    setSelectedDay(day);

    // Clear old availability when selection changes.
    setAvailability([]);

    setPageAlert((current) => ({
      ...current,
      visible: false,
    }));
  };

  /*
   * ----------------------------------------------------
   * Period change
   * ----------------------------------------------------
   */
  const handlePeriodChange = (
    value: string,
  ) => {
    setSelectedPeriod(Number(value));

    // Clear old availability.
    setAvailability([]);

    setPageAlert((current) => ({
      ...current,
      visible: false,
    }));
  };

  /*
   * ----------------------------------------------------
   * Check availability
   * ----------------------------------------------------
   */
  const handleGetAvailability = async () => {
    setPageAlert((current) => ({
      ...current,
      visible: false,
    }));

    if (!selectedCourtId) {
      setPageAlert({
        visible: true,
        variant: "error",
        title: "No Court Selected",
        description:
          "Please select an available court.",
      });

      return;
    }

    if (!selectedDay) {
      setPageAlert({
        visible: true,
        variant: "error",
        title: "No Day Selected",
        description:
          "Please select a booking day.",
      });

      return;
    }

    try {
      setIsCheckingAvailability(true);
      setAvailability([]);

      const response = await getCashierAvailability({ startDate, weeks: selectedPeriodData.weeks, daysOfWeek: [selectedDay] });

      const result =
        (response ?? []) as AvailabilityDay[];

      setAvailability(result);

      if (result.length === 0) {
        setPageAlert({
          visible: true,
          variant: "warning",
          title: "No Availability",
          description:
            "No available slots were found for the selected period.",
        });
      } else {
        setPageAlert({
          visible: true,
          variant: "success",
          title: "Availability Loaded",
          description:
            `Availability found for ${selectedDay}.`,
        });
      }
    } catch (error: unknown) {
      console.error(
        "Get availability error:",
        error,
      );

      const message = bookingError(error);

      setPageAlert({
        visible: true,
        variant: "error",
        title: "Failed to Get Availability",
        description: message,
      });

      setAvailability([]);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  /*
   * ----------------------------------------------------
   * Group response by date
   *
   * API response can contain multiple slots for
   * the same date.
   * ----------------------------------------------------
   */
  const availabilityByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        slots: AvailabilitySlot[];
      }
    >();

    availability.forEach((day) => {
      day.dayOfWeekDetails?.forEach(
        (slot) => {
          const existing = map.get(
            slot.date,
          );

          if (existing) {
            existing.slots.push(slot);
          } else {
            map.set(slot.date, {
              date: slot.date,
              slots: [slot],
            });
          }
        },
      );
    });

    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(a.date).getTime() -
        new Date(b.date).getTime(),
    );
  }, [availability]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* ALERT */}
      {pageAlert.visible && (
        <div className="mb-5">
          <Alert
            variant={pageAlert.variant}
            title={pageAlert.title}
            description={
              pageAlert.description
            }
            onClose={() =>
              setPageAlert((current) => ({
                ...current,
                visible: false,
              }))
            }
          />
        </div>
      )}

      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Special Booking Availability
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Check available recurring badminton
            slots by day and future period.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate("/special-bookings")
          }
          className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          <ArrowLeft size={16} />
          Back to Special Bookings
        </button>
      </div>

      {/* MAIN CARD */}
      <fieldset disabled={isCheckingAvailability || isLoadingCourts} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        {/* COURT */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Court
          </label>

          <div className="rounded-xl border border-amber-500 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-amber-800">
                  {isLoadingCourts
                    ? "Loading courts..."
                    : selectedCourt?.name ??
                      "No court selected"}
                </p>

                <p className="mt-0.5 text-xs text-amber-700">
                  Available for special booking
                </p>
              </div>

              {!isLoadingCourts &&
                selectedCourtId && (
                  <Check
                    size={19}
                    className="text-amber-600"
                  />
                )}
            </div>
          </div>
        </div>

        {/* BOOKING DAY */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Booking Day
            </label>

            <span className="text-xs text-gray-500">
              Select one day
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {WEEKDAYS.map((day) => {
              const selected =
                selectedDay === day;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    handleDaySelect(day)
                  }
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                    selected
                      ? "border-amber-500 bg-amber-50 text-amber-700 shadow-sm"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
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
            Selected day:{" "}
            <span className="font-medium text-gray-700">
              {selectedDay}
            </span>
          </div>
        </div>

        {/* FUTURE PERIOD */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Future Availability Period
          </label>

          <select
            value={selectedPeriod}
            onChange={(e) =>
              handlePeriodChange(
                e.target.value,
              )
            }
            className="w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 sm:max-w-md"
          >
            {periodOptions.map(
              (period) => (
                <option
                  key={period.weeks}
                  value={period.weeks}
                >
                  {period.label}
                </option>
              ),
            )}
          </select>

          <p className="mt-1.5 text-xs text-gray-500">
            Availability will be checked for
            approximately{" "}
            <span className="font-medium">
              {selectedPeriodData.weeks} weeks
            </span>
            .
          </p>
        </div>

        {/* REQUEST SUMMARY */}
        <div className="mb-6 rounded-xl bg-gray-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays
              size={17}
              className="text-gray-500"
            />

            <h3 className="text-sm font-semibold text-gray-800">
              Availability Request
            </h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">
                Day
              </p>

              <p className="mt-1 text-sm font-medium text-gray-900">
                {selectedDay}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">
                Future Period
              </p>

              <p className="mt-1 text-sm font-medium text-gray-900">
                {selectedPeriodData.label}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">
                Starting Date
              </p>

              <p className="mt-1 text-sm font-medium text-gray-900">
                {formatDate(
                  startDate,
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ACTION */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={
              handleGetAvailability
            }
            disabled={
              isCheckingAvailability ||
              isLoadingCourts ||
              !selectedCourtId
            }
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCheckingAvailability ? (
              <>
                <Loader2
                  size={16}
                  className="animate-spin"
                />
                Checking...
              </>
            ) : (
              <>
                <CalendarDays size={16} />
                Check Availability
              </>
            )}
          </button>
        </div>
      </fieldset>

      {/* RESULTS */}
      {availability.length > 0 && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Available Slots
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Available slots for{" "}
              <span className="font-medium text-gray-700">
                {selectedDay}
              </span>{" "}
              during the selected period.
            </p>
          </div>

          <div className="space-y-4">
            {availabilityByDate.map(
              (item) => (
                <div
                  key={item.date}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  {/* DATE */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-lg bg-amber-50 p-2">
                      <CalendarDays
                        size={18}
                        className="text-amber-600"
                      />
                    </div>

                    <div>
                      <p className="font-semibold text-gray-900">
                        {formatDayDate(
                          item.date,
                        )}
                      </p>

                      <p className="text-xs text-gray-500">
                        {formatDate(
                          item.date,
                        )}
                      </p>
                    </div>
                  </div>

                  {/* SLOTS */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {item.slots.map(
                      (slot) => (
                        <div
                          key={`${item.date}-${slot.availableSlotId}`}
                          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
                        >
                          <Clock3
                            size={15}
                            className="shrink-0 text-gray-500"
                          />

                          <span className="text-sm font-medium text-gray-700">
                            {
                              slot.availableSlotName
                            }
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {/* NO RESULT STATE */}
      {!isCheckingAvailability &&
        availability.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <CalendarDays
              size={28}
              className="mx-auto mb-3 text-gray-400"
            />

            <h3 className="text-sm font-semibold text-gray-700">
              No Availability Loaded
            </h3>

            <p className="mt-1 text-xs text-gray-500">
              Select a day and future period,
              then click Check Availability.
            </p>
          </div>
        )}
    </div>
  );
}