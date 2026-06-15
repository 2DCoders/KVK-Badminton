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

  const [selectedSlots, setSelectedSlots] = useState<{
    court: Court;
    slots: string[];
  } | null>(null);

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
        full: d,
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

      if (h === 12 || h === 17) status = "booked";

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

    if (!selectedSlots || selectedSlots.court !== court) {
      setSelectedSlots({
        court,
        slots: [slotId],
      });
      return;
    }

    const existing = [...selectedSlots.slots];

    if (existing.includes(slotId)) {
      const updated = existing.filter((s) => s !== slotId);

      setSelectedSlots(
        updated.length
          ? {
              court,
              slots: updated,
            }
          : null
      );

      return;
    }

    const indexes = existing.map((s) =>
      slots.findIndex((x) => x.id === s)
    );

    const min = Math.min(...indexes);
    const max = Math.max(...indexes);

    if (slotIndex === min - 1 || slotIndex === max + 1) {
      setSelectedSlots({
        court,
        slots: [...existing, slotId],
      });
    }
  };

  const isSelected = (court: Court, slotId: string) =>
    selectedSlots?.court === court &&
    selectedSlots.slots.includes(slotId);

  const duration = selectedSlots?.slots.length ?? 0;
  const total = duration * SLOT_PRICE;

  const renderCourt = (court: Court) => (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{court}</h3>

        <span className="text-xs text-gray-500">
          {slots.filter((s) => s.status === "available").length} Available
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
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
                text-sm
                font-medium
                border
                transition-all duration-200
                ${
                  selected
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : slot.status === "booked"
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : slot.status === "past"
                    ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
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
        <h1 className="text-2xl font-semibold text-gray-900">
          Court Booking
        </h1>

        <p className="text-sm text-gray-500 mt-1">
          Select a court and choose consecutive time slots.
        </p>
      </div>

      {/* Date Picker */}

      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {days.map((day, index) => (
            <button
              key={index}
              onClick={() => {
                setSelectedDate(index);
                setSelectedSlots(null);
              }}
              className={`
                px-4
                py-3
                rounded-xl
                border
                min-w-[90px]
                transition-all
                ${
                  selectedDate === index
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }
              `}
            >
              <div className="text-xs font-medium">
                {day.label}
              </div>

              <div className="text-base font-semibold">
                {day.day}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout */}

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
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
              <h3 className="font-semibold">
                Booking Summary
              </h3>
            </div>

            {selectedSlots ? (
              <>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500">
                      Court
                    </p>

                    <p className="font-medium">
                      {selectedSlots.court}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Selected Slots
                    </p>

                    <p className="font-medium">
                      {duration}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Duration
                    </p>

                    <p className="font-medium">
                      {duration} Hour{duration > 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="pt-3 border-t">
                    <p className="text-xs text-gray-500">
                      Total Amount
                    </p>

                    <p className="text-2xl font-bold text-amber-600">
                      Rs. {total.toLocaleString()}
                    </p>
                  </div>
                </div>

                <button
                  className="
                    w-full
                    mt-6
                    h-12
                    rounded-xl
                    bg-amber-500
                    hover:bg-amber-600
                    text-white
                    font-medium
                    transition-colors
                    flex
                    items-center
                    justify-center
                    gap-2
                  "
                >
                  Confirm Booking
                  <ChevronRight size={18} />
                </button>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">
                  Select consecutive slots to continue.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}