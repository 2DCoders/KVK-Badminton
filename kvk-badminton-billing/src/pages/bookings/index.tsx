import { useMemo, useState } from "react";
import { Calendar, ChevronRight } from "lucide-react";

type Court = "Court 1" | "Court 2";

interface Slot {
  id: string;
  time: string;
  status: "available" | "booked" | "past";
}

const SLOT_PRICE = 1500;

export default function Bookings() {
  const [selectedDate, setSelectedDate] = useState(0);

  // Multi-court selections
  const [selectedSlots, setSelectedSlots] = useState<Record<Court, string[]>>({
    "Court 1": [],
    "Court 2": [],
  });

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);

      return {
        label:
          i === 0
            ? "Today"
            : d.toLocaleDateString("en-US", {
                weekday: "short",
              }),
        day: d.getDate(),
      };
    });
  }, []);

  function formatHour(hour: number) {
    const suffix = hour >= 12 ? "PM" : "AM";
    const h = hour > 12 ? hour - 12 : hour;

    return `${h}${suffix}`;
  }

  const generateSlots = () => {
    const slots: Slot[] = [];

    for (let h = 9; h < 22; h++) {
      let status: Slot["status"] = "available";

      // demo booked slots
      if (h === 12 || h === 17) status = "booked";

      // disable past slots for today
      if (selectedDate === 0) {
        const now = new Date();

        if (h < now.getHours()) {
          status = "past";
        }
      }

      slots.push({
        id: `${h}`,
        time: formatHour(h),
        status,
      });
    }

    return slots;
  };

  const slots = generateSlots();

  const toggleSlot = (court: Court, slotId: string) => {
    const slotIndex = slots.findIndex((s) => s.id === slotId);

    setSelectedSlots((prev) => {
      const existing = [...prev[court]];

      // deselect
      if (existing.includes(slotId)) {
        return {
          ...prev,
          [court]: existing.filter((s) => s !== slotId),
        };
      }

      // first slot
      if (existing.length === 0) {
        return {
          ...prev,
          [court]: [slotId],
        };
      }

      const indexes = existing.map((s) => slots.findIndex((x) => x.id === s));

      const min = Math.min(...indexes);
      const max = Math.max(...indexes);

      // allow only consecutive extension
      if (slotIndex === min - 1 || slotIndex === max + 1) {
        return {
          ...prev,
          [court]: [...existing, slotId],
        };
      }

      return prev;
    });
  };

  const isSelected = (court: Court, slotId: string) =>
    selectedSlots[court]?.includes(slotId);

  const court1Slots = selectedSlots["Court 1"].length;
  const court2Slots = selectedSlots["Court 2"].length;

  const totalSlots = court1Slots + court2Slots;
  const totalAmount = totalSlots * SLOT_PRICE;

  const hasSelection = totalSlots > 0;

  const renderCourt = (court: Court) => (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{court}</h3>

        <span className="text-xs text-gray-500">
          {slots.filter((slot) => slot.status === "available").length} Available
        </span>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
        {slots.map((slot) => {
          const selected = isSelected(court, slot.id);

          return (
            <button
              key={slot.id}
              disabled={slot.status !== "available"}
              onClick={() => toggleSlot(court, slot.id)}
              className={`
                h-11
                rounded-xl
                border
                text-sm
                font-medium
                transition-all
                cursor-pointer
                ${
                  selected
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : slot.status === "booked"
                      ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}

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
              key={index}
              onClick={() => {
                setSelectedDate(index);

                setSelectedSlots({
                  "Court 1": [],
                  "Court 2": [],
                });
              }}
              className={`
                min-w-[120px]
                rounded-xl
                border
                px-4
                py-3
                cursor-pointer
                transition-all
                ${
                  selectedDate === index
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
          {renderCourt("Court 1")}
          {renderCourt("Court 2")}
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

                  {court1Slots > 0 && (
                    <div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Court 1</span>

                        <span className="font-medium">
                          {court1Slots} Hour
                          {court1Slots > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Court 2 */}

                  {court2Slots > 0 && (
                    <div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Court 2</span>

                        <span className="font-medium">
                          {court2Slots} Hour
                          {court2Slots > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  )}

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
