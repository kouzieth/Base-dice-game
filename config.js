// config.js - Environment Configuration
window.APP_CONFIG = {
  CONTRACT_ADDRESS: "0xC2f5a9296d67A45A1d17Aa29934B8a6c4DFE0657",
  NETWORK: "base-sepolia",
  ALCHEMY_API_KEY: "",
  MIN_BET: "0.001",
  MAX_BET: "0.1",
  HOUSE_EDGE: "5"
};

// Fallback untuk development
if (window.APP_CONFIG.CONTRACT_ADDRESS === "PASTE_YOUR_CONTRACT_ADDRESS_HERE") {
  console.warn("⚠️ Using default config. Set VERCEL environment variables for production.");
}

console.log("🔧 App Config Loaded:", window.APP_CONFIG);
