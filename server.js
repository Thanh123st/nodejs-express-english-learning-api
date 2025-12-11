const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("./src/config/db");
const logger = require("./src/config/logger");
const { globalLimiter, contactLimiter } = require("./src/middleware/rateLimiter");
const securityMiddleware = require("./src/middleware/security");
const keepAlive = require("./src/utils/keepAlive");
const contactRoutes = require("./src/routes/contactRoutes");
const authRoutes = require("./src/routes/authRoutes");
const lectureRoutes = require("./src/routes/lectureRoutes");
const documentRoutes = require("./src/routes/documentRoutes");
const documentShareRoutes = require("./src/routes/documentShareRoutes");
const lectureShareRoutes = require("./src/routes/lectureShareRoutes");
const categoryRoutes = require("./src/routes/categoryRoutes");
const collectionRoutes = require("./src/routes/collectionRoutes");
const savedRoutes = require("./src/routes/savedRoutes");
const qaRoutes = require("./src/routes/qaRoutes");
// thêm cookie-parser
const cookieParser = require("cookie-parser");

connectDB();
keepAlive();
const app = express();

// Middleware đọc JSON body
app.use(express.json());

// Middleware đọc cookie
app.use(cookieParser());

// Security middleware (helmet + cors)
securityMiddleware(app);

// Rate limit toàn bộ API
app.use(globalLimiter);

// Routes
app.use("/api/contacts", contactLimiter, contactRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/lectures", lectureRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/document-shares", documentShareRoutes);
app.use("/api/lecture-shares", lectureShareRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/saved", savedRoutes);
app.use("/api/qa", qaRoutes);
// 👇 Ping route để keep alive
app.get("/api/ping", (req, res) => {
  res
    .status(200)
    .json({ message: "pong 🏓", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
});
