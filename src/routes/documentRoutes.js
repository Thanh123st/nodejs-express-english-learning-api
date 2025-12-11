// routes/documentRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const verifyToken = require("../middleware/verifyToken"); // xác thực user
const {
  uploadDocument,
  getUserDocuments,
  updateDocument,
  deleteDocument,
  getPublicDocuments,
} = require("../controllers/documentController");

// Cấu hình multer (lưu tạm vào memory, upload trực tiếp lên S3)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload document (pdf, word, txt, etc)
router.post(
  "/",
  verifyToken,
  upload.single("file"), // field name 'file'
  uploadDocument
);

// Lấy danh sách document user có quyền xem
router.get("/user", verifyToken, getUserDocuments);

// Sửa document
router.put("/:id", verifyToken, upload.single("file"), updateDocument);

// Xóa document
router.delete("/:id", verifyToken, deleteDocument);

// Lấy tất cả document đang public
router.get("/public", verifyToken, getPublicDocuments);

module.exports = router;
