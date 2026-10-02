// src/config.ts

const LOCAL_API = "http://127.0.0.1:8000/api/v1";
const PRODUCTION_API = "https://iqmath-backend-61ky.onrender.com/api/v1";

function resolveApiBase(): string {
  const configured = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
  const configuredIsLocal = configured.length === 0 || /localhost|127\.0\.0\.1/.test(configured);
  const host = typeof window === "undefined" ? "" : window.location.hostname;
  const onThisMachine = host === "localhost" || host === "127.0.0.1";
  if (onThisMachine) return configured || LOCAL_API;
  if (!configuredIsLocal) return configured;
  return PRODUCTION_API;
}

// On iqnex.iqmath.in this uses the Render API, even if a build env still points at localhost.
export const API_BASE_URL = resolveApiBase();

export const endpoints = {
  login: `${API_BASE_URL}/login`,
  courses: `${API_BASE_URL}/courses`,
};

export default API_BASE_URL;