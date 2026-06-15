import axios from "axios";
import { getEnv } from "@/env";

const { API_URL } = getEnv();
const PAYMENTS_API_URL = `${API_URL}gym/payments/`;

const getToken = () => {
    const cashier = localStorage.getItem("cashier")
        ? JSON.parse(localStorage.getItem("cashier") as string)
        : null;

    return cashier ? cashier.token : null;
};

export const getPayments = async (startDate: string, endDate: string) => {
    const token = getToken();
    try {
        const query = `?from=${encodeURIComponent(startDate)}&to=${encodeURIComponent(endDate)}`;
        const response = await axios.get(`${PAYMENTS_API_URL}${query}`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}