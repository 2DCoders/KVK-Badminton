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

export const registerMember = async (memberData: any) => {
  try {
    const response = await axios.post(`${MEMBERS_API_URL}`, memberData, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getMembers = async () => {
  try {
    const response = await axios.get(`${MEMBERS_API_URL}`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

export const getMemberById = async (memberId: string) => {
  try {
    const response = await axios.get(`${MEMBERS_API_URL}${memberId}/`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateMember = async (memberId: string, memberData: any) => {
  try {
    const response = await axios.put(`${MEMBERS_API_URL}${memberId}/`, memberData, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateMembershipPlan = async (memberId: string, planData: any) => {
  try {
    const response = await axios.post(`${MEMBERS_API_URL}${memberId}/upgrade/`, planData, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

export const softDeleteMember = async (memberId: string) => {
  try {
    const response = await axios.post(`${MEMBERS_API_URL}${memberId}/soft-delete/`, {}, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}