import { useState } from "react";
import { Eye, Save, X } from "lucide-react";
import { createPortal } from "react-dom";

interface CourtConfig {
  enabled: boolean;
  price: number;
  startTime: string;
  endTime: string;
  duration: number;
  gap: number;
}

export default function CourtSettings() {
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [courts, setCourts] = useState<{
    court1: CourtConfig;
    court2: CourtConfig;
  }>({
    court1: {
      enabled: true,
      price: 1500,
      startTime: "09:00",
      endTime: "22:00",
      duration: 60,
      gap: 0,
    },
    court2: {
      enabled: true,
      price: 1500,
      startTime: "09:00",
      endTime: "22:00",
      duration: 60,
      gap: 0,
    },
  });

  const updateCourt = (
    court: "court1" | "court2",
    field: keyof CourtConfig,
    value: any,
  ) => {
    setCourts((prev) => ({
      ...prev,
      [court]: {
        ...prev[court],
        [field]: value,
      },
    }));
  };

  const generateSlots = (config: CourtConfig) => {
    const slots: string[] = [];

    const start = new Date(`2024-01-01T${config.startTime}`);
    const end = new Date(`2024-01-01T${config.endTime}`);

    const current = new Date(start);

    while (current < end) {
      const slotStart = new Date(current);

      current.setMinutes(current.getMinutes() + config.duration);

      if (current > end) break;

      const slotEnd = new Date(current);

      slots.push(
        `${slotStart.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })} - ${slotEnd.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      );

      current.setMinutes(current.getMinutes() + config.gap);
    }

    return slots;
  };

  const CourtPreview = ({
    title,
    court,
  }: {
    title: string;
    court: CourtConfig;
  }) => (
    <div className="border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>

        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">
          {generateSlots(court).length} Slots
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">Operating Hours</p>

          <p className="font-medium">
            {court.startTime} - {court.endTime}
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">Slot Duration</p>

          <p className="font-medium">{court.duration} Min</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
        {generateSlots(court).map((slot, index) => (
          <div
            key={index}
            className="
            bg-gray-50
            border
            border-gray-200
            rounded-lg
            px-3
            py-2
            text-xs
            text-center
            font-medium
          "
          >
            {slot}
          </div>
        ))}
      </div>
    </div>
  );

  const courtCard = (title: string, key: "court1" | "court2") => {
    const court = courts[key];

    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-5">{title}</h3>

        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Court Status</span>

            <button
              onClick={() => updateCourt(key, "enabled", !court.enabled)}
              className={`
                relative w-12 h-6 rounded-full transition cursor-pointer
                ${court.enabled ? "bg-green-500" : "bg-gray-300"}
              `}
            >
              <span
                className={`
                  absolute top-0.5 left-0.5
                  w-5 h-5 rounded-full bg-white
                  transition
                  ${court.enabled ? "translate-x-6" : ""}
                `}
              />
            </button>
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-2">
              Price Per Slot (Rs.)
            </label>

            <input
              type="number"
              value={court.price}
              onChange={(e) =>
                updateCourt(key, "price", Number(e.target.value))
              }
              className="w-full h-11 rounded-xl border border-gray-200 px-3"
            />
          </div>
        </div>
      </div>
    );
  };

  const slotConfig = (title: string, key: "court1" | "court2") => {
    const court = courts[key];

    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="font-semibold mb-5">{title}</h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 block mb-2">
              Start Time
            </label>

            <input
              type="time"
              value={court.startTime}
              onChange={(e) => updateCourt(key, "startTime", e.target.value)}
              className="w-full h-11 rounded-xl border border-gray-200 px-3"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-2">End Time</label>

            <input
              type="time"
              value={court.endTime}
              onChange={(e) => updateCourt(key, "endTime", e.target.value)}
              className="w-full h-11 rounded-xl border border-gray-200 px-3"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-2">
              Slot Duration (Min)
            </label>

            <input
              type="number"
              value={court.duration}
              onChange={(e) =>
                updateCourt(key, "duration", Number(e.target.value))
              }
              className="w-full h-11 rounded-xl border border-gray-200 px-3"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-2">
              Slot Gap (Min)
            </label>

            <input
              type="number"
              value={court.gap}
              onChange={(e) => updateCourt(key, "gap", Number(e.target.value))}
              className="w-full h-11 rounded-xl border border-gray-200 px-3"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Court Settings</h1>

          <p className="text-sm text-gray-500 mt-1">
            Configure courts and slot schedules.
          </p>
        </div>

        {/* Court Settings */}

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold">Court Configuration</h2>

            <button
              className="h-11 px-5 rounded-xl bg-gradient-to-r
          cursor-pointer
                from-amber-500
                via-amber-600
                to-orange-700 text-white flex items-center gap-2"
            >
              <Save size={18} />
              Save Changes
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {courtCard("Court 1", "court1")}
            {courtCard("Court 2", "court2")}
          </div>
        </div>

        {/* Slot Settings */}

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold">Slot Configuration</h2>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSlotsModal(true)}
                className="h-11 px-5 rounded-xl border cursor-pointer border-gray-200 flex items-center gap-2"
              >
                <Eye size={18} />
                View Slots
              </button>

              <button
                className="h-11 px-5 rounded-xl bg-gradient-to-r
            cursor-pointer
                  from-amber-500
                  via-amber-600
                  to-orange-700 text-white flex items-center gap-2"
              >
                <Save size={18} />
                Save Slots
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {slotConfig("Court 1", "court1")}
            {slotConfig("Court 2", "court2")}
          </div>
        </div>
      </div>

      {showSlotsModal &&
        createPortal(
          <div
            className="
                fixed
                inset-0
                z-[9999]
                flex
                items-center
                justify-center
                bg-black/70
                backdrop-blur-sm
            "
          >
            <div
              className="
                bg-white
                rounded-3xl
                shadow-2xl
                w-full
                max-w-5xl
                max-h-[90vh]
                overflow-hidden
            "
            >
              {/* Header */}

              <div className="flex items-center justify-between px-6 py-5 border-b">
                <div>
                  <h2 className="text-xl font-semibold">Generated Slots</h2>

                  <p className="text-sm text-gray-500 mt-1">
                    Preview slot generation before saving
                  </p>
                </div>

                <button
                  onClick={() => setShowSlotsModal(false)}
                  className="
                    h-10
                    w-10
                    rounded-xl
                    border
                    border-gray-200
                    flex
                    items-center
                    justify-center
                    hover:bg-gray-50
                    cursor-pointer
                "
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="grid lg:grid-cols-2 gap-6">
                  <CourtPreview title="Court 1" court={courts.court1} />

                  <CourtPreview title="Court 2" court={courts.court2} />
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
