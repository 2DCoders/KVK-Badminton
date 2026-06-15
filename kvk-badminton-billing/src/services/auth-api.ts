import { getEnv } from "@/env";
import axios from "axios";

const { API_URL } = getEnv();
const AUTH_API_URL = `${API_URL}identity-m/auth/`;

const getToken = () => {
    const cashier = localStorage.getItem("cashier")
        ? JSON.parse(localStorage.getItem("cashier") as string)
        : null;

    return cashier ? cashier.token : null;
};


export const login = async (username: string, password: string) => {
  try {
    const response = await axios.post(`${AUTH_API_URL}staff/login`, { username, password });
    return response.data;
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
};

export const changePassword = async (body: any) => {
  try {
    const response = await axios.post(`${AUTH_API_URL}staff/change-password`, body, {
      headers: {
        Authorization: `Bearer ${getToken()}`
      }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}