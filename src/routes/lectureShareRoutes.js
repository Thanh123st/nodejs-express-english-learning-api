// routes/lectureShareRoutes.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { createShare, getSharedLectures, deleteShare, getSharesByLecture } = require("../controllers/lectureShareController");

// Share bài giảng
router.post("/", verifyToken, createShare);

// Lấy danh sách bài giảng share cho user
router.get("/", verifyToken, getSharedLectures);

// Hủy share
router.delete("/:id", verifyToken, deleteShare);

// Lấy danh sách user được share cho 1 bài giảng
router.get("/by-lecture/:lectureId", verifyToken, getSharesByLecture);

module.exports = router;
