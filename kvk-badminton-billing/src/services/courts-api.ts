import axios from "axios";
import { getEnv } from "@/env";

const { API_URL } = getEnv();
const COURTS_API_URL = `${API_URL}badminton/courts/`;

const getToken = () => {
  const cashier = localStorage.getItem("cashier")
    ? JSON.parse(localStorage.getItem("cashier") as string)
    : null;

  return cashier ? cashier.token : null;
};


export const getCourts = async () => {
  try {
    const response = await axios.get(`${COURTS_API_URL}`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateCourt = async (courtId: string, courtData: any) => {
  try {
    const response = await axios.put(`${COURTS_API_URL}${courtId}/`, courtData, {
        headers: {
            Authorization: `Bearer ${getToken()}`,
        },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};