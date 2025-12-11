const rateLimit = require('express-rate-limit');

// Rate limiter chung cho toàn bộ API
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 20000, // tối đa 200 request / IP / 15 phút
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests from this IP, please try again later.",
  },
});

// Rate limiter riêng cho form Contact Us
const contactLimiter = rateLimit({
  windowMs: (parseInt(process.env.CONTACT_WINDOW_MINUTES || '15', 10)) * 60 * 1000,
  max: parseInt(process.env.CONTACT_MAX_REQUESTS || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many contact requests from this IP, please try again later.",
  },
});

module.exports = { globalLimiter, contactLimiter };
