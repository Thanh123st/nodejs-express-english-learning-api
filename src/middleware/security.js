const helmet = require("helmet");
const cors = require("cors");

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(origin => origin.trim())
  : [];

const securityMiddleware = (app) => {
  // Bảo mật header
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.error("❌ Blocked by CORS:", origin);
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE"], // nên khai báo rõ
      credentials: true,
    })
  );
};

module.exports = securityMiddleware;
