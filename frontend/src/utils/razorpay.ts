const PRODUCTION_RAZORPAY_KEY_ID = "rzp_test_TiLwM8zI9XqrMI";
const PRODUCTION_PAYLINK = "https://razorpay.me/@iqmathtechnologies";

const usable = (value: unknown, fallback: string) => {
  const text = String(value ?? "").trim();
  if (!text || text.includes("replace_me") || text.startsWith("your_")) return fallback;
  return text;
};

export const razorpayKeyId = () => usable(import.meta.env.VITE_RAZORPAY_KEY_ID, PRODUCTION_RAZORPAY_KEY_ID);

export const razorpayPaylink = () => usable(import.meta.env.VITE_RAZORPAY_PAYLINK_URL, PRODUCTION_PAYLINK);

export const ensureRazorpay = () => new Promise<void>((resolve, reject) => {
  const host = window as Window & { Razorpay?: unknown };
  if (host.Razorpay) {
    resolve();
    return;
  }
  const script = document.createElement("script");
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.async = true;
  script.onload = () => resolve();
  script.onerror = () => reject(new Error("Razorpay checkout did not load."));
  document.head.appendChild(script);
});

/** Prefer the key that created the order so checkout matches the API Razorpay account. */
export const checkoutKey = (orderKey?: string | null) => {
  const fromOrder = String(orderKey || "").trim();
  if (fromOrder.startsWith("rzp_")) return fromOrder;
  return razorpayKeyId();
};

/** Keep checkout simple. Custom method blocks often break Standard Checkout. */
export const withPaymentMethods = <T extends object>(options: T) => ({
  ...options,
});
