import axios from "axios";
import type { AxiosError } from "axios";

let expired = false;
let installed = false;
const listeners = new Set<() => void>();

export const getSessionExpired = () => expired;

export const subscribeToSessionExpiry = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function installSessionExpiryHandler(accountKey: "admin" | "cashier") {
  if (installed) return;
  installed = true;

  axios.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      // Invalid login credentials are handled by the login form.
      const isLoginRequest = /\/staff\/login\/?(?:\?|$)/i.test(error.config?.url ?? "");
      if (error.response?.status === 401 && !isLoginRequest && !expired) {
        expired = true;
        localStorage.removeItem(accountKey);
        if (accountKey === "cashier") {
          localStorage.removeItem("dayEndData");
        }
        listeners.forEach((listener) => listener());
      }
      return Promise.reject(error);
    },
  );
}

export function redirectToLogin() {
  window.location.replace("/");
}
