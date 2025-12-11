// controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const redisClient = require("../config/redis");
const admin = require("../config/firebaseAdmin");

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

/* ==================== LOGIN ==================== */
// POST /api/auth/login
async function loginWithFirebase(req, res) {
  try {
    const { idToken } = req.body;
    if (!idToken)
      return res.status(400).json({ message: "No ID token provided" });

    // Xác thực ID token với Firebase
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // Kiểm tra user trong MongoDB
    let user = await User.findOne({ uid });
    if (!user) {
      user = new User({
        uid,
        email,
        name: name || "",
        photoURL: picture || null,
      });
      await user.save();
    } else if (user.isBanned) {
      return res.status(403).json({ message: "Account has been banned" });
    }

    // Tạo access token & refresh token
    const accessToken = jwt.sign(
      { uid: user.uid, email: user.email, id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { uid: user.uid },
      REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    // Lưu refresh token vào Redis (7 ngày)
    await redisClient.setEx(`refresh_${user.uid}`, 7 * 24 * 60 * 60, refreshToken);

    // Thiết lập cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,     // bật true khi dùng HTTPS
      sameSite: "None",
      maxAge: 15 * 60 * 1000, // 15 phút
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        uid: user.uid,
        email: user.email,
        name: user.name,
        photoURL: user.photoURL,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error("[Auth] Error in loginWithFirebase:", err);
    res.status(401).json({ message: "Invalid ID token", error: err.message });
  }
}

/* ==================== REFRESH ==================== */
// POST /api/auth/refresh
async function refreshAccessToken(req, res) {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken)
    return res.status(400).json({ message: "No refresh token provided" });

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    const storedToken = await redisClient.get(`refresh_${decoded.uid}`);

    if (!storedToken || storedToken !== refreshToken)
      return res.status(401).json({ message: "Invalid refresh token" });

    const user = await User.findOne({ uid: decoded.uid });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isBanned) return res.status(403).json({ message: "Account has been banned" });

    // Tạo mới access token
    const newAccessToken = jwt.sign(
      { uid: user.uid, email: user.email, id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 15 * 60 * 1000,
    });

    res.json({ message: "Access token refreshed" });
  } catch (err) {
    console.error("[Auth] Refresh token error:", err);
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
}

/* ==================== LOGOUT ==================== */
// POST /api/auth/logout
async function logout(req, res) {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken)
    return res.status(400).json({ message: "No refresh token provided" });

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    await redisClient.del(`refresh_${decoded.uid}`);

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("[Auth] Logout error:", err);
    res.status(400).json({ message: "Invalid refresh token" });
  }
}

module.exports = {
  loginWithFirebase,
  refreshAccessToken,
  logout,
};
