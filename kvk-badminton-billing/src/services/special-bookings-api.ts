import axios from "axios";
import { getEnv } from "@/env";

export type MemberCourt = { id: string; name: string };
export type MemberSlot = { courtId: string; slotId: string; startTime: string; endTime: string; price: number };
export type BookingSchedule = { startDate: string; weeks: number; slotIds: string[]; daysOfWeek: string[] };
export type BookingSetup = { court: MemberCourt; slots: MemberSlot[]; maximumWeeks: number };
export type AvailabilityQuote = { isAvailable: boolean; originalAmount: number; endDate: string; bookingCount: number; unavailableSchedules: { date: string; slotId: string; slotName: string; message: string }[] };
export type BookingHold = { holdToken: string; expiresInSeconds: number; originalAmount: number; endDate: string; bookingCount: number };
export type CouponQuote = { originalAmount: number; discountAmount: number; finalAmount: number };
export type BookingConfirmation = { succeeded: boolean; finalAmount: number; bookings: { bookingNumber: string; bookingDate: string; bookingAmount: number }[] };
const auth = () => {
  const cashier = JSON.parse(localStorage.getItem("cashier") || "null");
  return { headers: { Authorization: `Bearer ${cashier?.token ?? ""}` } };
};
const endpoint = (path: string) => `${getEnv().API_URL.replace(/\/?$/, "/")}member-badminton-bookings/${path}`;
export async function getMemberBookingSetup(signal?: AbortSignal) {
  return (await axios.get<BookingSetup>(endpoint("setup"), { ...auth(), signal })).data;
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
export async function quoteMemberCoupon(holdToken: string, couponCode: string) {
  return (await axios.post<CouponQuote>(endpoint("coupon"), { holdToken, couponCode }, auth())).data;
}
export async function releaseMemberHold(token: string) {
  await axios.delete(endpoint(`hold/${encodeURIComponent(token)}`), { ...auth(), timeout: 10000 });
}
export type CashierConfirmationRequest = { holdToken: string; customerName: string; phoneNumber: string; couponCode: string; paymentType: 1 | 2 };
export async function confirmCashierBooking(request: CashierConfirmationRequest) {
  return (await axios.post<BookingConfirmation>(endpoint("cashier-confirm"), request, auth())).data;
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
