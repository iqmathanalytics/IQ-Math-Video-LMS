import axios from "axios";

const fresh = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 12000;

const keyOf = (config: { method?: string; baseURL?: string; url?: string; params?: unknown }) =>
  `${(config.method || "get").toLowerCase()}:${config.baseURL || ""}${config.url || ""}:${JSON.stringify(config.params || {})}`;

axios.interceptors.request.use((config) => {
  if ((config.method || "get").toLowerCase() !== "get") return config;
  const hit = fresh.get(keyOf(config));
  if (!hit || Date.now() - hit.at > TTL_MS) return config;
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
