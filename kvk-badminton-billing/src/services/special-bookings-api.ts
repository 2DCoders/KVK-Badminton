import axios from "axios";
import { getEnv } from "@/env";

export type MemberCourt = { id: string; name: string };
export type MemberSlot = { courtId: string; slotId: string; startTime: string; endTime: string; price: number };
export type BookingSchedule = { courtId?: string; courtIds?: string[]; startDate: string; weeks: number; slotIds: string[]; daysOfWeek: string[] };
export type BookingSetup = { courts: MemberCourt[]; slots: MemberSlot[]; maximumWeeks: number };
export type CashierPricing = {
  originalAmount: number;
  promotionDiscount: number;
  promotionPercentage: number;
  promotionSlotCount: number;
  couponDiscount: number;
  couponSlotCount: number;
  finalAmount: number;
  isPromotion: boolean;
};
export type AvailabilityQuote = { isAvailable: boolean; originalAmount: number; endDate: string; bookingCount: number; pricing?: CashierPricing; unavailableSchedules: { courtId?: string; date: string; slotId: string; slotName: string; message: string }[] };
export type BookingHold = { holdToken: string; expiresInSeconds: number; originalAmount: number; endDate: string; bookingCount: number; pricing?: CashierPricing };
export type BookingConfirmation = { succeeded: boolean; finalAmount: number; bookings: { bookingNumber: string; bookingDate: string; bookingAmount: number }[] };
const auth = () => {
  const cashier = JSON.parse(localStorage.getItem("cashier") || "null");
  return { headers: { Authorization: `Bearer ${cashier?.token ?? ""}` } };
};
const endpoint = (path: string) => `${getEnv().API_URL.replace(/\/?$/, "/")}member-badminton-bookings/${path}`;
export async function getCashierBookingSetup(signal?: AbortSignal) {
  try {
    return (await axios.get<BookingSetup>(endpoint("cashier-setup"), { ...auth(), signal })).data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      throw new Error("Sign in again with a staff account assigned to Badminton to access Special Bookings.");
    }
    throw error;
  }
}
export async function checkMemberBooking(schedule: BookingSchedule) {
  return (await axios.post<AvailabilityQuote>(endpoint("check-availability"), schedule, auth())).data;
}
export async function holdMemberBooking(schedule: BookingSchedule) {
  return (await axios.post<BookingHold>(endpoint("hold"), schedule, auth())).data;
}
export async function checkAndHoldMemberBooking(schedule: BookingSchedule) {
  const availability = await checkMemberBooking(schedule);
  const hold = availability.isAvailable ? await holdMemberBooking(schedule) : null;
  return { availability, hold };
}
export async function quoteCashierBooking(holdToken: string, couponCode: string) {
  return (await axios.post<CashierPricing>(endpoint("cashier-quote"), { holdToken, couponCode }, auth())).data;
}
export async function releaseMemberHold(token: string) {
  await axios.delete(endpoint(`hold/${encodeURIComponent(token)}`), { ...auth(), timeout: 10000 });
}
export type CashierCustomerRequest = { holdToken: string; customerName: string; phoneNumber: string; couponCode: string; expectedAmount: number };
export type CashierConfirmationRequest = CashierCustomerRequest & { paymentType: 1 | 2 };
export async function confirmCashierBooking(request: CashierConfirmationRequest) {
  return (await axios.post<BookingConfirmation>(endpoint("cashier-confirm"), request, auth())).data;
}

export type CashierSlipReservation = {
  reference: string;
  customerName: string;
  phoneNumber: string;
  finalAmount: number;
  paymentDueUtc: string;
  slipRevision?: string | null;
  smsSent: boolean;
  slotCount: number;
  status: "awaiting_slip" | "ready" | "expired" | "approved";
};

export async function holdCashierSlip(request: CashierCustomerRequest) {
  return (await axios.post<CashierSlipReservation>(endpoint("cashier-slips"), request, auth())).data;
}
export async function holdRegularCashierSlip(request: {
  holdIds: string[]; customerName: string; phoneNumber: string; expectedAmount: number;
}) {
  return (await axios.post<CashierSlipReservation>(endpoint("cashier-slips/regular"), request, auth())).data;
}
export async function getCashierSlips(signal?: AbortSignal) {
  return (await axios.get<CashierSlipReservation[]>(endpoint("cashier-slips"), { ...auth(), signal })).data;
}
export async function uploadCashierSlip(reference: string, file: File) {
  const form = new FormData();
  form.append("slip", file);
  return (await axios.post<CashierSlipReservation>(endpoint(`cashier-slips/${encodeURIComponent(reference)}/slip`), form, auth())).data;
}
export async function downloadCashierSlip(reference: string) {
  return (await axios.get<Blob>(endpoint(`cashier-slips/${encodeURIComponent(reference)}/slip`), { ...auth(), responseType: "blob" })).data;
}
export async function approveCashierSlip(reference: string, revision: string) {
  return (await axios.post<CashierSlipReservation>(endpoint(`cashier-slips/${encodeURIComponent(reference)}/approve/${encodeURIComponent(revision)}`), null, auth())).data;
}
export function bookingError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    return (typeof data === "string" && data.length < 250 ? data : data?.message || data?.title || data?.error) || "Unable to connect. Please try again.";
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export type SessionAvailability = { date: string; status: "available" | "booked" | "held" | "past" };
export type SlotAvailability = { slotId: string; startTime: string; endTime: string; availableCount: number; totalCount: number; availableEveryWeek: boolean; sessions: SessionAvailability[] };
export type CashierAvailability = { startDate: string; endDate: string; weeks: number; dates: string[]; slots: SlotAvailability[] };
export async function getCashierAvailability(schedule: Omit<BookingSchedule, "slotIds">, signal?: AbortSignal) {
  return (await axios.post<CashierAvailability>(endpoint("cashier-availability"), schedule, { ...auth(), signal })).data;
}
