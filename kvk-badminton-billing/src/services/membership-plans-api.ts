import axios from "axios";
import { getEnv } from "@/env";

const { API_URL } = getEnv();
const MEMBERSHIP_PLANS_API_URL = `${API_URL}gym/membership-plans/`;

const getToken = () => {
  const cashier = localStorage.getItem("cashier")
    ? JSON.parse(localStorage.getItem("cashier") as string)
    : null;

  return cashier ? cashier.token : null;
};

export const getMembershipPlans = async () => {
  try {
    const response = await axios.get(`${MEMBERSHIP_PLANS_API_URL}`, {
        headers: {
            Authorization: `Bearer ${getToken()}`,
        },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};