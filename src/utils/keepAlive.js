// src/utils/keepAlive.js
const axios = require("axios");

const keepAlive = () => {
  const url = process.env.KEEP_ALIVE_URL; // để trong .env cho linh hoạt
  if (!url) {
    console.warn("⚠️ KEEP_ALIVE_URL not set, skipping keepAlive");
    return;
  }

  setInterval(async () => {
    try {
      await axios.get(url);
      console.log(`🔄 KeepAlive ping: ${url}`);
    } catch (err) {
      console.error("❌ KeepAlive failed:", err.message);
    }
  }, 5 * 60 * 1000); // 5 phút ping một lần
};

module.exports = keepAlive;
