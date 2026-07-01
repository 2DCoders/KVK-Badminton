import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import { createPortal } from "react-dom";
import { getCourts, updateCourt } from "@/services/courts-api";
import { Alert } from "@/components/ui/alert";
import { createSlot, getSlotById, updateSlot } from "@/services/slots-api";
import { useNavigate } from "react-router-dom";

export default function CourtSettings() {
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [courts, setCourts] = useState<any[]>([]);
  const [slot, setSlot] = useState<any | null>(null);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("22:00");
  const [duration, setDuration] = useState(60);
  const [gap, setGap] = useState(0);
  const [selectedCourtId, setSelectedCourtId] = useState("");
  const [pageAlert, setPageAlert] = useState<{
    visible: boolean;
    variant?: "success" | "error" | "warning" | "info";
    title?: string;
    description?: string;
  }>({ visible: false });
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const dayendData = localStorage.getItem("dayEndData") ? JSON.parse(localStorage.getItem("dayEndData") as string) : null;

  useEffect(() => {
    if (!dayendData) {
      // navigate("/dayend");
    }
  }, [dayendData]);

  const handleFetchCourts = async () => {
    setLoading(true);
    try {
      const response = await getCourts();
      setCourts(response);
    } catch (error) {
      setPageAlert({
        visible: true,
        variant: "error",
        title: "Fetch Courts Failed",
        description:
          "An error occurred while fetching court data. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFetchSlot = async (id: string) => {
    setLoading(true);
    try {
      const response = await getSlotById(id);
      setSlot(response);
      setStartTime(response.startTime);
      setEndTime(response.endTime);
      setDuration(response.slotDurationMinutes);
      setGap(response.slotGapMinutes);
    } catch (error) {
      setSlot(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCourt = async (courtId: string, courtData: any) => {
    setLoading(true);

    if (courtData.status === 0) {
      courtData.status = 2; // Set to 2 (inactive) when toggled off
    }
    try {
      await updateCourt(courtId, courtData);
      setPageAlert({
        visible: true,
        variant: "success",
        title: "Court Updated",
        description: "Successfully updated.",
      });
      await handleFetchCourts();
    } catch (error) {
      setPageAlert({
        visible: true,
        variant: "error",
        title: "Update Court Failed",
        description:
          "An error occurred while updating the court. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSlot = async (courtId: string) => {
    const body = {
      courtId,
      startTime,
      endTime,
      slotDurationMinutes: duration,
      slotGapMinutes: gap,
      isActive: 1,
    };

    setLoading(true);

    try {
      await createSlot(body);
      setPageAlert({
        visible: true,
        variant: "success",
        title: "Slot Created",
        description: "Successfully created slot for the court.",
      });
      await handleFetchSlot(courtId);
    } catch (error) {
      setPageAlert({
        visible: true,
        variant: "error",
        title: "Create Slot Failed",
        description:
          "An error occurred while creating the slot. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSlot = async () => {
    const body = {
      id: slot?.id,
      courtId: slot?.courtId,
      startTime,
      endTime,
      slotDurationMinutes: duration,
      slotGapMinutes: gap,
      isActive: 1,
    };

    setLoading(true);

    try {
      await updateSlot(slot?.id, body);
      setPageAlert({
        visible: true,
        variant: "success",
        title: "Slot Updated",
        description: "Successfully updated slot for the court.",
      });
      await handleFetchSlot(slot?.courtId);
    } catch (error) {
      setPageAlert({
        visible: true,
        variant: "error",
        title: "Update Slot Failed",
        description:
          "An error occurred while updating the slot. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleFetchCourts();
  }, []);

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
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
        {loading && createPortal (
          <div className="fixed inset-0 z-[9999999999] flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="flex flex-col items-center gap-3">
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
              <p className="text-sm text-white font-medium">Loading</p>
            </div>
          </div>,
          document.body
        )}
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

            {/* <div className="flex gap-3">
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
            </div> */}
          </div>

          <div className="mb-6">
            <label className="text-sm text-gray-600 block mb-2">
              Active Slot Configuration
            </label>

            <select
              value={selectedCourtId}
              onChange={(e) => {
                setSelectedCourtId(e.target.value);
                handleFetchSlot(e.target.value);
              }}
              className="w-full md:w-80 h-11 rounded-xl border border-gray-200 px-3 bg-white cursor-pointer"
            >
              <option value="">Select a slot configuration</option>

              {courts
                .filter((c) => c.status === 1)
                .map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name}
                  </option>
                ))}
            </select>
          </div>

          {slot === "" && (
            <>
              <p className="text-sm text-gray-500 mb-5">
                No slot configurations found. Please configure courts to
                generate slots.
              </p>

              <div className="grid md:grid-cols-1 gap-5">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold mb-5">
                    {selectedCourtId
                      ? courts.find((c) => c.id === selectedCourtId)?.name
                      : "Select a Court"}
                  </h3>
                  <button
                    className="h-10 px-3 rounded-xl bg-gradient-to-r
                        disabled:opacity-50 disabled:cursor-not-allowed
                        cursor-pointer
                        from-amber-500
                        via-amber-600
                        to-orange-700 text-white flex items-center gap-2"
                    onClick={() => handleCreateSlot(selectedCourtId)}
                  >
                    <Save size={18} />
                    Create
                  </button>
                </div>

                <div  className="space-y-4 md:grid md:grid-cols-2 md:gap-5">
                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      Slot Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                      className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      Slot Gap (minutes)
                    </label>
                    <input
                      type="number"
                      value={gap}
                      onChange={(e) => setGap(parseInt(e.target.value))}
                      className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {slot && (
            <div>
              <p className="text-sm text-gray-500 mb-5">
                Slot configuration found for the selected court.
              </p>
              <div className="grid md:grid-cols-1 gap-5">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold mb-5">
                    {selectedCourtId
                      ? courts.find((c) => c.id === selectedCourtId)?.name
                      : "Select a Court"}
                  </h3>
                  <button
                    className="h-10 px-3 rounded-xl bg-gradient-to-r
                        cursor-pointer
                        disabled:opacity-50 disabled:cursor-not-allowed
                        from-amber-500
                        via-amber-600
                        to-orange-700 text-white flex items-center gap-2"
                    onClick={() => handleUpdateSlot()}
                  >
                    <Save size={18} />
                    Update
                  </button>
                </div>

                <div className="space-y-4 md:grid md:grid-cols-2 md:gap-5">
                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      Slot Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                      className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-2">
                      Slot Gap (minutes)
                    </label>
                    <input
                      type="number"
                      value={gap}
                      onChange={(e) => setGap(parseInt(e.target.value))}
                      className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
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
