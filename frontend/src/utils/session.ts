const TOKEN_KEY = "token";
const ROLE_KEY = "role";
const LOGIN_AT_KEY = "login_at";

export type SessionData = {
  token: string;
  role: string;
  loginAt: number;
};

export const saveSession = (token: string, role: string) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(LOGIN_AT_KEY);
};

export const getValidSession = (): SessionData | null => {
  const token = localStorage.getItem(TOKEN_KEY);
  const role = localStorage.getItem(ROLE_KEY);
  const loginAtRaw = localStorage.getItem(LOGIN_AT_KEY);
  const loginAt = Number(loginAtRaw);

  if (!token || !role || !Number.isFinite(loginAt)) {
    clearSession();
    return null;
  }

  const expMs = tokenExpiryMs(token);
  if (!expMs || Date.now() >= expMs) {
    clearSession();
    return null;
  }

  return { token, role, loginAt };
};

const tokenExpiryMs = (token: string) => {
  try {
    const part = token.split(".")[1] || "";
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
};
