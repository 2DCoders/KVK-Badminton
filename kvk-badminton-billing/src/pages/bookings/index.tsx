import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronRight, X } from "lucide-react";
import { getNextWorkingDays } from "@/services/holidays-api";
import { getSlotsAvailability } from "@/services/slots-api";
import { getCourts } from "@/services/courts-api";
import { bookingSlots, confirmBooking } from "@/services/booking-api";
import { createPortal } from "react-dom";
import { Alert } from "@/components/ui/alert";

interface Slot {
  id: string;
  time: string;
  status: "available" | "booked" | "past";
}

interface SlotAvailability {
  id: string;
  courtId: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  price: number;
  isBooked: boolean;
}

const SLOT_PRICE = 1500;

export default function Bookings() {
  const [selectedDate, setSelectedDate] = useState(0);
  const [days, setDays] = useState<
    {
      label: string;
      day: number;
      date: string;
    }[]
  >([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentTypes, setPaymentTypes] = useState(1);
  const [holdSlots, setHoldSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageAlert, setPageAlert] = useState<{
    visible: boolean;
    variant?: "success" | "error" | "warning" | "info";
    title?: string;
    description?: string;
  }>({ visible: false });
  const [courtSlots, setCourtSlots] = useState<
    Record<string, SlotAvailability[]>
  >({});

  const handleGetCourts = async () => {
    try {
      const response = await getCourts();

      setCourts(response);

    } catch (error) {
      console.error("Error fetching courts:", error);
    }
  };

  const [selectedSlots, setSelectedSlots] = useState<
    Record<string, string[]>
  >({});


  const handleGetNextWorkingDays = async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const startDate = yesterday.toISOString().split("T")[0];

    try {
      const workingDays = await getNextWorkingDays(startDate, 7);

      const mappedDays = workingDays.map(
        (dateString: string, index: number) => {
          const date = new Date(dateString);

          return {
            label:
              index === 0
                ? "Today"
                : date.toLocaleDateString("en-US", {
                  weekday: "short",
                }),
            day: date.getDate(),
            date: dateString,
          };
        }
      );

      setDays(mappedDays);
    } catch (error) {
      console.error("Error fetching next working days:", error);
    }
  };

  const handleGetSlotsAvailability = async (date: string) => {
    try {
      const responses = await Promise.all(
        courts.map(async (court) => {
          const slots = await getSlotsAvailability(court.id, date);

          return {
            courtId: court.id,
            slots,
          };
        })
      );

      const mapped: Record<string, SlotAvailability[]> = {};

      responses.forEach((item) => {
        mapped[item.courtId] = item.slots;
      });

      setCourtSlots(mapped);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    handleGetNextWorkingDays();
    handleGetCourts();
  }, []);

  useEffect(() => {
    if (!days.length || !courts.length) return;

    handleGetSlotsAvailability(days[selectedDate].date);
  }, [days, selectedDate, courts]);

  const handleBookingMultipleSlots = async () => {
    setLoading(true);
    try {
      const bookings = Object.entries(selectedSlots).flatMap(
        ([courtId, slotIds]) =>
          slotIds.map((slotId) => ({
            courtId,
            courtSlotId: slotId,
            bookingDate: days[selectedDate].date.slice(0, 10),
          }))
      );

      const payload = {
        bookings,
        totalAmount,
        paymentTypes,
      };

      const res = await bookingSlots(payload);

      setHoldSlots(res?.additionalData?.response || []);
      handleGetSlotsAvailability(days[selectedDate].date);
    } catch (error) {
      setPageAlert({
        visible: true,
        variant: "error",
        title: "Booking Error",
        description: "An error occurred while booking slots. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSlot = (
    courtId: string,
    formattedSlots: any[],
    slotId: string
  ) => {

    const slotIndex = formattedSlots.findIndex(s => s.id === slotId);

    setSelectedSlots(prev => {

      const existing = [...(prev[courtId] || [])];

      if (existing.includes(slotId)) {
        return {
          ...prev,
          [courtId]: existing.filter(x => x !== slotId),
        };
      }

      if (existing.length === 0) {
        return {
          ...prev,
          [courtId]: [slotId],
        };
      }

      const indexes = existing.map(id =>
        formattedSlots.findIndex(x => x.id === id)
      );

      const min = Math.min(...indexes);
      const max = Math.max(...indexes);

      if (slotIndex === min - 1 || slotIndex === max + 1) {
        return {
          ...prev,
          [courtId]: [...existing, slotId],
        };
      }

      return prev;
    });
  };

  const totalSlots = Object.values(selectedSlots).reduce(
    (sum, slots) => sum + slots.length,
    0
  );

  const handleLoopConfirmBooking = async () => {

    if(!customerName || !phoneNumber) {
      setPageAlert({
        visible: true,
        variant: "error",
        title: "Missing Information",
        description: "Please provide both customer name and phone number.",
      });
      return;
    }

    if (holdSlots.length === 0) {
      setPageAlert({
        visible: true,
        variant: "error",
        title: "No Slots Held",
        description: "Please hold slots before confirming the booking.",
      });
      return;
    }

    if (phoneNumber.length < 10 || phoneNumber.length > 10 || !/^\d+$/.test(phoneNumber)) {
      setPageAlert({
        visible: true,
        variant: "error",
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-digit phone number.",
      });
      return;
    }

    setLoading(true);

    try{
      for (const hold of holdSlots) {
      await handleConfirmBooking(hold.holdId);
    }
    setPageAlert({
      visible: true,
      variant: "success",
      title: "Booking Confirmed",
      description: "Your booking has been successfully confirmed.",
    });
    
    setLoading(false);
    setSelectedSlots({});
    setCustomerName("");
    setPhoneNumber("");
    setPaymentTypes(1);
    setIsBookingModalOpen(false);
    } catch (error) {
      setPageAlert({
        visible: true,
        variant: "error",
        title: "Confirmation Error",
        description: "An error occurred while confirming the booking. Please try again.",
      });
      setLoading(false);
    }
  }

  const handleConfirmBooking = async (holdId: string) => {
    try {
      await confirmBooking(holdId, {
        customerName: customerName,
        phoneNumber: phoneNumber,
      });
    } catch (error) {
      setPageAlert({
        visible: true,
        variant: "error",
        title: "Confirmation Error",
        description: "An error occurred while confirming the booking. Please try again.",
      });
      setLoading(false);
    }
  }

  const totalAmount = totalSlots * SLOT_PRICE;
  const hasSelection = totalSlots > 0;

  const bookingSummary = courts
    .map((court) => {
      const selected = selectedSlots[court.id] || [];

      if (selected.length === 0) return null;

      const slots = (courtSlots[court.id] || []).filter((s) =>
        selected.includes(s.id)
      );

      return {
        courtName: court.name,
        slots,
      };
    })
    .filter(Boolean);

  const renderCourt = (court: any) => {
    const formattedSlots: Slot[] = (courtSlots[court.id] || []).map((slot) => {
      let status: Slot["status"] = "available";

      if (slot.isBooked) {
        status = "booked";
      }

      if (selectedDate === 0) {
        const now = new Date();
        const hour = Number(slot.startTime.split(":")[0]);

        if (hour < now.getHours()) {
          status = "past";
        }
      }

      return {
        id: slot.id,
        time: new Date(`2000-01-01T${slot.startTime}`).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
        status,
      };
    });

    const availableCount = formattedSlots.filter(
      (slot) => slot.status === "available"
    ).length;

    return (
      <div
        key={court.id}
        className="bg-white rounded-2xl border border-gray-200 p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{court.name}</h3>

          <span className="text-xs text-gray-500">
            {availableCount} Available
          </span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
          {formattedSlots.map((slot) => {
            const selected = (selectedSlots[court.id] || []).includes(slot.id);

            return (
              <button
                key={slot.id}
                disabled={slot.status !== "available"}
                onClick={() =>
                  toggleSlot(court.id, formattedSlots, slot.id)
                }
                className={`
                h-11
                rounded-xl
                border
                text-sm
                font-medium
                transition-all
                cursor-pointer
                ${selected
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : slot.status === "booked"
                      ? "bg-green-100 border-green-200 text-black-400 cursor-not-allowed"
                      : slot.status === "past"
                        ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
                        : "bg-white border-gray-200 hover:border-gray-400"
                  }
              `}
              >
                {slot.time}
              </button>
            );
          })}
        </div>
      </div>
    );
  };


  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}

      {loading && createPortal(
        <div className="fixed inset-0 z-[9999999999] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
            <p className="text-sm text-white font-medium">Loading</p>
          </div>
        </div>,
        document.body
      )}

      {pageAlert.visible && (
        <div>
          <Alert
            variant={pageAlert.variant as any}
            title={pageAlert.title}
            description={pageAlert.description}
            onClose={() => setPageAlert((s) => ({ ...s, visible: false }))}
          />
        </div>
      )}

      {
        isBookingModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white">
              <div className="flex items-center justify-between border-b p-5">
                <div>
                  <h2 className="text-2xl font-semibold">
                    Confirm Booking
                  </h2>

                  <p className="text-sm text-gray-500">
                    Complete customer details before confirming.
                  </p>
                </div>

                <button
                  onClick={() => setIsBookingModalOpen(false)}
                  className="p-2 rounded-full hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">

                <div>

                  <div className="grid gap-4 md:grid-cols-2">

                    <div>

                      <label className="text-sm font-medium">
                        Customer Name
                      </label>

                      <input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:border-amber-500"
                      />

                    </div>

                    <div>

                      <label className="text-sm font-medium">
                        Phone Number
                      </label>

                      <input
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:border-amber-500"
                      />

                    </div>

                  </div>

                </div>

                <div className="mt-6 mb-6 border-t pt-6">

                  <h3 className="font-semibold mb-3">
                    Payment Method
                  </h3>

                  <div className="flex gap-4">

                    <label className="flex items-center gap-3 cursor-pointer">

                      <input
                        type="radio"
                        checked={paymentTypes === 1}
                        onChange={() => setPaymentTypes(1)}
                      />

                      Cash

                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">

                      <input
                        type="radio"
                        checked={paymentTypes === 2}
                        onChange={() => setPaymentTypes(2)}
                      />

                      Card

                    </label>

                  </div>

                </div>

                <div>

                  <h3 className="font-semibold mb-3">
                    Booking Summary
                  </h3>

                  <div className="rounded-xl border">

                    {bookingSummary.map((court: any) => (
                      <div
                        key={court.courtName}
                        className="border-b last:border-b-0 p-4"
                      >

                        <div className="font-medium mb-2">
                          {court.courtName}
                        </div>

                        <div className="space-y-1">

                          {court.slots.map((slot: any) => (
                            <div
                              key={slot.id}
                              className="flex justify-between text-sm text-gray-600"
                            >

                              <span>
                                {slot.startTime} - {slot.endTime}
                              </span>

                              <span>
                                Rs. {slot.price.toLocaleString()}
                              </span>

                            </div>
                          ))}

                        </div>

                      </div>
                    ))}

                    <div className="p-4 space-y-2">

                      <div className="flex justify-between">

                        <span>Total Slots</span>

                        <span>{totalSlots}</span>

                      </div>

                      <div className="flex justify-between">

                        <span>Total Amount</span>

                        <span className="font-bold text-lg text-amber-600">

                          Rs. {totalAmount.toLocaleString()}

                        </span>

                      </div>

                    </div>

                  </div>

                </div>

                <div className="flex justify-end gap-3 bg-white p-5">
                  <button
                    onClick={() => setIsBookingModalOpen(false)}
                    className="rounded-lg border px-5 py-2 cursor-pointer text-gray-700 font-medium hover:bg-gray-100"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleLoopConfirmBooking}
                    disabled={loading || !customerName || !phoneNumber}
                    className="rounded-lg bg-amber-600 px-6 cursor-pointer py-2 text-white font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Confirm Booking
                  </button>
                </div>

              </div>

            </div>

          </div>,
          document.body
        )
      }

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Court Booking</h1>

        <p className="text-sm text-gray-500 mt-1">
          Select consecutive slots from one or multiple courts.
        </p>
      </div>

      {/* Date Selector */}

      <div className="mb-6 overflow-x-auto">
        <div className="flex justify-between gap-2 min-w-max">
          {days.map((day, index) => (
            <button
              key={day.date}
              onClick={() => {
                setSelectedDate(index);
                setSelectedSlots({});
              }}
              className={`
      min-w-[120px]
      rounded-xl
      border
      px-4
      py-3
      cursor-pointer
      transition-all
      ${selectedDate === index
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "bg-white border-gray-200 hover:border-gray-300"
                }
    `}
            >
              <div className="text-xs font-medium">{day.label}</div>
              <div className="text-base font-semibold">{day.day}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout */}

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* Courts */}

        <div className="space-y-4">
          {courts.map((court) => (
            <div key={court.id}>
              {renderCourt(court)}
            </div>
          ))}
        </div>

        {/* Summary */}

        <div className="lg:sticky lg:top-6 h-fit">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-5">
              <Calendar size={18} />
              <h3 className="font-semibold">Booking Summary</h3>
            </div>

            {!hasSelection ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-500">
                  Select slots to continue
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-5">
                  {/* Court 1 */}

                  {courts.map((court) => {
                    const count = selectedSlots[court.id]?.length || 0;

                    if (count === 0) return null;

                    return (
                      <div key={court.id}>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">
                            {court.name}
                          </span>

                          <span className="font-medium">
                            {count} Hour{count > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  <div className="border-t pt-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-500">Total Slots</span>

                      <span className="font-semibold">{totalSlots}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Rate</span>

                      <span>Rs. {SLOT_PRICE.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Amount</span>

                      <span className="text-2xl font-bold text-amber-600">
                        Rs. {totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsBookingModalOpen(true)
                    handleBookingMultipleSlots()
                  }}
                  className="
                    w-full
                    mt-6
                    h-12
                    rounded-xl
                    bg-gradient-to-r
                from-amber-500
                via-amber-600
                to-orange-700
                    text-white
                    font-medium
                    transition-colors
                    flex
                    items-center
                    justify-center
                    gap-2
                    cursor-pointer
                  "
                >
                  Confirm Booking
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
