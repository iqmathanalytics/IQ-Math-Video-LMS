import axios from "axios";

const fresh = new Map<string, { at: number; data: unknown }>();
const SHORT_TTL_MS = 12_000;
const PUBLIC_TTL_MS = 90_000;

const keyOf = (config: { method?: string; baseURL?: string; url?: string; params?: unknown }) =>
  `${(config.method || "get").toLowerCase()}:${config.baseURL || ""}${config.url || ""}:${JSON.stringify(config.params || {})}`;

const ttlFor = (url: string) => {
  const path = url.toLowerCase();
  if (path.includes("/public/") || path.endsWith("/watch") || path.includes("/watch?")) {
    return PUBLIC_TTL_MS;
  }
  return SHORT_TTL_MS;
};

axios.interceptors.request.use((config) => {
  if ((config.method || "get").toLowerCase() !== "get") return config;
  const key = keyOf(config);
  const hit = fresh.get(key);
  const url = `${config.baseURL || ""}${config.url || ""}`;
  if (!hit || Date.now() - hit.at > ttlFor(url)) return config;
  config.adapter = async () => ({
    data: hit.data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
    request: {},
  });
  return config;
});

axios.interceptors.response.use((response) => {
  const method = (response.config.method || "get").toLowerCase();
  if (method === "get") fresh.set(keyOf(response.config), { at: Date.now(), data: response.data });
  else fresh.clear();
  return response;
});
