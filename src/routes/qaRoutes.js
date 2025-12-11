const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const rateLimitNewUser = require("../middleware/rateLimitNewUser")
const {
  createQuestion,
  updateQuestionStatus,
  createAnswer,
  updateAnswerStatus,
  listPublishedQuestions,
  getQuestionDetail,
  listMyQA,
} = require("../controllers/qaController");

// Câu hỏi
router.post("/questions", verifyToken,rateLimitNewUser, upload.array("attachments"), createQuestion);
router.patch("/questions/:id/status", verifyToken, updateQuestionStatus);
router.get("/questions", verifyToken, listPublishedQuestions);
router.get("/questions/:id", verifyToken, getQuestionDetail);

// Câu trả lời
router.post("/answers", verifyToken,rateLimitNewUser, upload.array("attachments"), createAnswer);
router.patch("/answers/:id/status", verifyToken, updateAnswerStatus);

// Danh sách Q&A của bản thân
router.get("/my", verifyToken, listMyQA);

module.exports = router;
