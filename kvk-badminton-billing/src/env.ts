// src/env.ts
export const getEnv = () => {
  const env = (window as any).env;
  return {
    API_URL: env?.API_URL ?? "",
    BOOKING_DURATION: env?.BOOKING_DURATION,
    BADMINTON_BOOKING_START_DATE: env?.BADMINTON_BOOKING_START_DATE
  };
};
