// src/config.ts

// Vite bakes VITE_API_URL in at build time.
// Local dev falls back to the API on this machine. Production sets the Render URL.
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

export const endpoints = {
  login: `${API_BASE_URL}/login`,
  courses: `${API_BASE_URL}/courses`,
};

export default API_BASE_URL;