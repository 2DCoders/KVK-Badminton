import axios from "axios";
import { getEnv } from "@/env";

const { API_URL } = getEnv();
const BOOKING_API_URL = `${API_URL}badminton/bookings/`;
const TEMP_BOOKING_API_URL = `${API_URL}temporary-bookings/`;

const getToken = () => {
  const cashier = localStorage.getItem("cashier")
    ? JSON.parse(localStorage.getItem("cashier") as string)
    : null;

  return cashier ? cashier.token : null;
};

export const bookingSlots = async (bookingData: any) => {
    try {
        const response = await axios.post(`${BOOKING_API_URL}multi-hold`, bookingData, {
            headers: {
                Authorization: `Bearer ${getToken()}`,
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const confirmBooking = async (customerData: any) => {
    try {
        const response = await axios.post(`${BOOKING_API_URL}confirm-multi`, customerData, {
            headers: {
                Authorization: `Bearer ${getToken()}`,
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const WALK_IN_PENDING_PAYMENT = 5;

export async function createWalkIn(booking: { holdIds: string[]; customerName: string; phoneNumber: string }) {
    await axios.post(`${BOOKING_API_URL}walk-ins`, booking, {
        headers: { Authorization: `Bearer ${getToken()}` },
    });
}

export async function payWalkIn(walkInId: string, paymentType: 1 | 2) {
    await axios.post(`${BOOKING_API_URL}walk-ins/${walkInId}/pay`, { paymentType }, {
        headers: { Authorization: `Bearer ${getToken()}` },
    });
}

export const checkAvailabilityTemp = async (bookingData: any) => {
    try {
        const response = await axios.post(`${TEMP_BOOKING_API_URL}check-availability`, bookingData, {
            headers: {
                Authorization: `Bearer ${getToken()}`,
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const tempBookingSlots = async (bookingData: any) => {
    try {
        const response = await axios.post(`${TEMP_BOOKING_API_URL}`, bookingData, {
            headers: {
                Authorization: `Bearer ${getToken()}`,
                "Content-Type": "multipart/form-data",
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const getBookingsList = async (params: {
    fromDate?: string;
    toDate?: string;
    status?: number;
    includePendingWalkIns?: boolean;
    courtId?: string;
    searchTerm?: string;
    pageNumber?: number;
    pageSize?: number;
}, signal?: AbortSignal) => {
    try {
        const query = new URLSearchParams(
            Object.entries(params).reduce((acc, [key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    acc[key] = String(value);
                }
                return acc;
            }, {} as Record<string, string>),
        ).toString();

        const response = await axios.get(`${BOOKING_API_URL}?${query}`, {
            signal,
            headers: {
                Authorization: `Bearer ${getToken()}`,
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const getAvailabilityTemp = async (bookingData: any) => {
    try {
        const response = await axios.post(`${TEMP_BOOKING_API_URL}availability-for-certain-period`, bookingData, {
            headers: {
                Authorization: `Bearer ${getToken()}`,
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}
