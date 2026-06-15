import axios from "axios";
import { getEnv } from "@/env";

const { API_URL } = getEnv();
const MEMBERS_API_URL = `${API_URL}gym/members/`;

const getToken = () => {
    const cashier = localStorage.getItem("cashier")
        ? JSON.parse(localStorage.getItem("cashier") as string)
        : null;

    return cashier ? cashier.token : null;
};

export const processPayment = async (paymentData: any, memberId: string) => {
    try {
        const response = await axios.post(`${MEMBERS_API_URL}${memberId}/payments/`, paymentData, {
            headers: {
                                Authorization: `Bearer ${getToken()}`,
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}