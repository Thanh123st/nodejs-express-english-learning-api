// middlewares/rateLimitNewUser.js
const redisClient = require("../config/redis");

const MAX_QUESTIONS_PER_DAY = 3;
const MAX_ANSWERS_PER_DAY = 8;

/**
 * Middleware: Giới hạn số lượng câu hỏi / câu trả lời mỗi ngày
 * Áp dụng cho user có role = "news"
 */
async function rateLimitNewUser(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id, role } = req.user;
    if (role !== "news") return next(); // Chỉ giới hạn user mới

    // Xác định loại hành động
    const isAnswer = req.path.toLowerCase().includes("answer");
    const action = isAnswer ? "answers" : "questions";
    const limit = isAnswer ? MAX_ANSWERS_PER_DAY : MAX_QUESTIONS_PER_DAY;

    const key = `limit:${action}:${id}`;

    // Lấy giá trị hiện tại trong Redis
    let count = await redisClient.get(key);
    count = parseInt(count || "0", 10);

    if (count >= limit) {
      return res.status(429).json({
        message: `Bạn đã đạt giới hạn ${limit} ${isAnswer ? "câu trả lời" : "câu hỏi"} trong hôm nay.`,
      });
    }

    if (count === 0) {
      // Nếu là lần đầu, tạo key với TTL = 24h
      await redisClient.set(key, 1, { EX: 24 * 60 * 60 });
    } else {
      // Nếu đã tồn tại, chỉ cần tăng lên
      await redisClient.incr(key);
    }

    next();
  } catch (err) {
    console.error("[RateLimitNewUser] Redis error:", err.message);
    // fallback: cho phép request nếu Redis có vấn đề
    next();
  }
}

module.exports = rateLimitNewUser;
