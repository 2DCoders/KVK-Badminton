import axios from "axios";
import { getEnv } from "@/env";

const { API_URL } = getEnv();

const OFFER_API_URL = `${API_URL}identity/offer-rate/`;

const getToken = () => {
  const cashierData = localStorage.getItem("cashier");

  const cashier = cashierData
    ? JSON.parse(cashierData)
    : null;

  return cashier?.token ?? null;
};

export const validateCoupon = async (couponCode: string,  originalAmount: string) => {
  const code = couponCode.trim();

  if (!code) {
    throw new Error("Coupon code is required.");
  }

  try {
    const response = await axios.get(`${OFFER_API_URL}validate-coupons`,
      {
        params: {
          couponCode: code,
          originalAmount,
          moduleName: "badminton",
        },
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      },
    );
    return response.data;
  } catch (error: any) {
    throw error;
  }
};