export const razorpayKeyId = () => {
  const key = import.meta.env.VITE_RAZORPAY_KEY_ID;
  if (!key || String(key).includes("replace_me")) return "";
  return String(key);
};

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
