// routes/lectureRoutes.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken"); // xác thực user
const multer = require("multer");
const { createLecture, getUserLectures, updateLecture, deleteLecture, getPublicLectures } = require("../controllers/lectureController");

// Lưu file vào memory (buffer) để upload trực tiếp lên Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Tạo lecture mới (video)
router.post("/", verifyToken, upload.single("video"), createLecture);

// Lấy tất cả lecture của user
router.get("/user", verifyToken, getUserLectures);

// Sửa lecture
router.put("/:id", verifyToken, upload.single("video"), updateLecture);


// Xóa lecture
router.delete("/:id", verifyToken, deleteLecture);

// Lấy tất cả lecture đang public
router.get("/public", verifyToken, getPublicLectures);

module.exports = router;
