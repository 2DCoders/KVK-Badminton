import axios from "axios";
import { getEnv } from "@/env";

const { API_URL } = getEnv();
const DP_MEMBERS_API_URL = `${API_URL}gym/day-pass-members/`;

const getToken = () => {
  const cashier = localStorage.getItem("cashier")
    ? JSON.parse(localStorage.getItem("cashier") as string)
    : null;

  return cashier ? cashier.token : null;
};

export const registerDayPassMember = async (memberData: any) => {
  try {
    const response = await axios.post(`${DP_MEMBERS_API_URL}`, memberData, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getDayPassMembers = async () => {
  try {
    const response = await axios.get(`${DP_MEMBERS_API_URL}`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteDayPassMember = async (memberId: string) => {
  try {
    const response = await axios.delete(`${DP_MEMBERS_API_URL}${memberId}/`, {
        headers: {
            Authorization: `Bearer ${getToken()}`,
        },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};