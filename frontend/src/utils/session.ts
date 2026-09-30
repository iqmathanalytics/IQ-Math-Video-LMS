const TOKEN_KEY = "token";
const ROLE_KEY = "role";
const LOGIN_AT_KEY = "login_at";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

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

  if (Date.now() - loginAt > SESSION_TTL_MS) {
    clearSession();
    return null;
  }

  return { token, role, loginAt };
};
