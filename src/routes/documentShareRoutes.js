const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const {
  createShare,
  getSharedDocuments,
  deleteShare,
  getSharesByDocument,
} = require("../controllers/documentShareController");

// Share document với user
router.post("/", verifyToken, createShare);

// Lấy danh sách document share cho user
router.get("/", verifyToken, getSharedDocuments);

// Hủy share
router.delete("/:id", verifyToken, deleteShare);

// Lấy danh sách user được share cho 1 document
router.get("/by-document/:documentId", verifyToken, getSharesByDocument);

module.exports = router;
