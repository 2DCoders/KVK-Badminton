import axios from "axios";
import { getEnv } from "@/env";

const { API_URL } = getEnv();
const HOLIDAYS_API_URL = `${API_URL}identity/holidays/`;


export const getNextWorkingDays = async (startDate: string, count: number) => {
    try {
        const response = await axios.get(`${HOLIDAYS_API_URL}next-working-days?startDate=${startDate}&count=${count}`);
        return response.data;
    } catch (error) {
        throw error;
    }
}