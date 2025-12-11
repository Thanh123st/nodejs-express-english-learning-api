const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware xác thực JWT token từ cookie
const verifyToken = (req, res, next) => {
  // Log cookie nhận được
  console.log("========== VERIFY TOKEN DEBUG ==========");
  console.log("[Cookies received]:", req.cookies);
  console.log("[JWT_SECRET exists?]", !!JWT_SECRET);

  // Lấy token từ cookie
  const token = req.cookies?.accessToken;
  console.log("[AccessToken cookie]:", token);

  if (!token) {
    console.log("[Auth] ❌ No token cookie found");
    console.log("========================================");
    return res.status(401).json({ message: "No token" });
  }

  try {
    // Verify token backend
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("[Auth] ✅ Token verified successfully:", decoded);

    // Gắn thông tin user vào req.user
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      id: decoded.id,
    };

    console.log("[Auth] User attached to req.user:", req.user);
    console.log("========================================");
    next();
  } catch (err) {
    console.error("[Auth] ❌ Token verification failed:");
    console.error("→ Error type:", err.name);
    console.error("→ Error message:", err.message);
    console.error("→ Raw token value:", token);
    console.error("→ JWT_SECRET sample:", JWT_SECRET?.slice(0, 6) + "...");

    console.log("========================================");
    return res.status(401).json({
      message: "Invalid or expired token",
      error: err.message,
    });
  }
};

module.exports = verifyToken;
