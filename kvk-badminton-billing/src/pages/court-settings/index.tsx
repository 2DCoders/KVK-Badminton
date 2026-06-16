import { useEffect, useState } from "react";
import { Eye, Save, X } from "lucide-react";
import { createPortal } from "react-dom";
import { getCourts, updateCourt } from "@/services/courts-api";

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
  const [courts, setCourts] = useState<any[]>([]);

  const handleFetchCourts = async () => {
    try {
      const response = await getCourts();
      setCourts(response);
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateCourt = async (courtId: string, courtData: any) => {
    console.log("Updating court:", courtData);

    if (courtData.status === 0) {
      courtData.status = 2; // Set to 2 (inactive) when toggled off
    }
    try {
      await updateCourt(courtId, courtData);
      await handleFetchCourts();
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    handleFetchCourts();
  }, []);

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
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {courts.map((court, index) => (
              <div
                key={court.id}
                className="bg-white rounded-2xl border border-gray-200 p-5"
              >
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold">{court.name}</h3>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => {
                        const updated = [...courts];
                        updated[index].status =
                          updated[index].status === 1 ? 0 : 1;

                        setCourts(updated);
                      }}
                      className={`
                      relative w-12 h-6 rounded-full transition-all duration-300 cursor-pointer
                      ${court.status === 1 ? "bg-green-500" : "bg-gray-300"}
                    `}
                    >
                      <span
                        className={`
                      absolute top-0.5 left-0.5
                      w-5 h-5 bg-white rounded-full
                      transition-transform duration-300
                      ${court.status === 1 ? "translate-x-6" : ""}
                    `}
                      />
                    </button>

                    <button
                      className="h-10 px-3 rounded-xl bg-gradient-to-r
            cursor-pointer
                  from-amber-500
                  via-amber-600
                  to-orange-700 text-white flex items-center gap-2"
                      onClick={() => handleUpdateCourt(court.id, court)}
                    >
                      <Save size={18} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-600 block mb-2">
                    Price Per Slot
                  </label>

                  <input
                    type="number"
                    disabled
                    value={court.pricePerSlot}
                    className="w-full h-11 rounded-xl border border-gray-200 px-3 cursor-not-allowed bg-gray-50"
                    onChange={(e) => {
                      const updated = [...courts];
                      updated[index].pricePerSlot = Number(e.target.value);
                      setCourts(updated);
                    }}
                  />
                </div>
              </div>
            ))}
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
            {courts.map((court, index) => (
              <div
                key={court.id}
                className="bg-white rounded-2xl border border-gray-200 p-5"
              >
                <h3 className="font-semibold mb-5">{court.name}</h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={court.startTime || "09:00"}
                      className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={court.endTime || "22:00"}
                      className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      Slot Duration
                    </label>
                    <input
                      type="number"
                      value={court.duration || 60}
                      className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      Slot Gap
                    </label>
                    <input
                      type="number"
                      value={court.gap || 0}
                      className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    />
                  </div>
                </div>
              </div>
            ))}
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

              {/* <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="grid lg:grid-cols-2 gap-6">
                  <CourtPreview title="Court 1" court={courts.court1} />

                  <CourtPreview title="Court 2" court={courts.court2} />
                </div>
              </div> */}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
