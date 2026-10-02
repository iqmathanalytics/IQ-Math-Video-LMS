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

/** UPI, cards, netbanking, and wallets for a paid course. */
export const withPaymentMethods = <T extends object>(options: T) => ({
  ...options,
  method: {
    upi: true,
    card: true,
    netbanking: true,
    wallet: true,
  },
  config: {
    display: {
      blocks: {
        upi: { name: "UPI", instruments: [{ method: "upi" }] },
        card: { name: "Cards", instruments: [{ method: "card" }] },
        netbanking: { name: "Netbanking", instruments: [{ method: "netbanking" }] },
        wallet: { name: "Wallets", instruments: [{ method: "wallet" }] },
      },
      sequence: ["block.upi", "block.card", "block.netbanking", "block.wallet"],
      preferences: { show_default_blocks: true },
    },
  },
});
