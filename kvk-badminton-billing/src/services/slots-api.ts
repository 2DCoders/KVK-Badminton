import axios from "axios";
import { getEnv } from "@/env";

const { API_URL } = getEnv();
const SLOTS_API_URL = `${API_URL}badminton/court-slot-configurations/`;

const getToken = () => {
  const cashier = localStorage.getItem("cashier")
    ? JSON.parse(localStorage.getItem("cashier") as string)
    : null;

  return cashier ? cashier.token : null;
};

export const getSlotById = async (id: string) => {
    try {
        const response = await axios.get(`${SLOTS_API_URL}court/${id}`, {
            headers: {
                Authorization: `Bearer ${getToken()}`,
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const createSlot = async (slotData: any) => {
    try {
        const response = await axios.post(`${SLOTS_API_URL}`, slotData, {
            headers: {
                Authorization: `Bearer ${getToken()}`,
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const updateSlot = async (slotId: string, slotData: any) => {
    try {
        const response = await axios.put(`${SLOTS_API_URL}${slotId}/`, slotData, {
            headers: {
                Authorization: `Bearer ${getToken()}`,
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const getSlotsAvailability = async (courtId: string, date: string) => {
    try {
        const response = await axios.get(`${SLOTS_API_URL}availability-by-court?courtId=${courtId}&date=${date}`, {
            headers: {
                Authorization: `Bearer ${getToken()}`,
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}
