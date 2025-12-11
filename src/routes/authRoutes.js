// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const { loginWithFirebase, refreshAccessToken, logout } = require("../controllers/authController");

// POST /api/auth/login
router.post("/login", loginWithFirebase);

// POST /api/auth/refresh
router.post("/refresh", refreshAccessToken);

// POST /api/auth/logout
router.post("/logout", logout);

module.exports = router;
