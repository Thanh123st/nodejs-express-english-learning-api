const Question = require("../models/Question");
const Answer = require("../models/Answer");
const mongoose = require("mongoose");
const { s3 } = require("../config/aws");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { attachIsSaved } = require("../utils/isSavedHelper");

/* ------------------ Helper: upload file to S3 ------------------ */
async function uploadToS3(file, folder = "qa") {
  const ext = path.extname(file.originalname);
  const key = `${folder}/${Date.now()}-${uuidv4()}${ext}`;

  await s3
    .upload({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: "private",
    })
    .promise();

  return { key, mimeType: file.mimetype };
}

/* ------------------ Helper: signed URL ------------------ */
function getSignedS3Url(key) {
  if (!key) return null;
  return s3.getSignedUrl("getObject", {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Expires: 3600, // 1h
  });
}

/* ==========================
   1️⃣ Đăng câu hỏi
========================== */
async function createQuestion(req, res) {
  try {
    const { title, content, tags, category } = req.body;

    if (!title || !content)
      return res.status(400).json({ message: "Thiếu tiêu đề hoặc nội dung" });

    const attachments = [];
    if (req.files?.length) {
      for (const file of req.files) {
        const uploaded = await uploadToS3(file, "questions");
        attachments.push(uploaded);
      }
    }

    const question = await Question.create({
      title,
      content,
      tags: tags ? tags.split(",").map(t => t.trim()) : [],
      category: category || null,
      attachments,
      createdBy: req.user.id,
    });

    res.status(201).json({ message: "Tạo câu hỏi thành công", question });
  } catch (err) {
    console.error("[Q&A] createQuestion error:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
}

/* ==========================
   2️⃣ Cập nhật trạng thái câu hỏi
========================== */
async function updateQuestionStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["published", "hidden"].includes(status))
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });

    const question = await Question.findById(id);
    if (!question) return res.status(404).json({ message: "Không tìm thấy câu hỏi" });
    if (question.createdBy.toString() !== req.user.id)
      return res.status(403).json({ message: "Không có quyền chỉnh sửa" });

    question.status = status;
    await question.save();

    res.json({ message: "Cập nhật trạng thái thành công", question });
  } catch (err) {
    console.error("[Q&A] updateQuestionStatus error:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
}

/* ==========================
   3️⃣ Trả lời câu hỏi
========================== */
async function createAnswer(req, res) {
  try {
    const { questionId, content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(questionId))
      return res.status(400).json({ message: "ID câu hỏi không hợp lệ" });

    const question = await Question.findById(questionId);
    if (!question || question.status !== "published")
      return res.status(404).json({ message: "Câu hỏi không tồn tại hoặc bị ẩn" });

    const attachments = [];
    if (req.files?.length) {
      for (const file of req.files) {
        const uploaded = await uploadToS3(file, "answers");
        attachments.push(uploaded);
      }
    }

    const answer = await Answer.create({
      question: questionId,
      content,
      attachments,
      createdBy: req.user.id,
    });

    question.answersCount += 1;
    await question.save();

    res.status(201).json({ message: "Trả lời thành công", answer });
  } catch (err) {
    console.error("[Q&A] createAnswer error:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
}

/* ==========================
   4️⃣ Cập nhật trạng thái trả lời
========================== */
async function updateAnswerStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["published", "hidden"].includes(status))
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });

    const answer = await Answer.findById(id);
    if (!answer) return res.status(404).json({ message: "Không tìm thấy câu trả lời" });
    if (answer.createdBy.toString() !== req.user.id)
      return res.status(403).json({ message: "Không có quyền chỉnh sửa" });

    answer.status = status;
    await answer.save();

    res.json({ message: "Cập nhật trạng thái thành công", answer });
  } catch (err) {
    console.error("[Q&A] updateAnswerStatus error:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
}

/* ==========================
   5️⃣ Lấy tất cả câu hỏi đã publish (có tìm kiếm)
========================== */
async function listPublishedQuestions(req, res) {
  try {
    const { q = "", tag, page = 1, limit = 10 } = req.query;

    const filter = { status: "published" };

    // 🔍 Nếu có từ khóa tìm kiếm
    if (q.trim()) {
      filter.$or = [
        { title: { $regex: q.trim(), $options: "i" } },
        { content: { $regex: q.trim(), $options: "i" } },
      ];
    }

    // 🔖 Nếu có lọc theo tag
    if (tag) {
      filter.tags = tag;
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

    const [questions, total] = await Promise.all([
      Question.find(filter)
        .populate("createdBy", "name email")
        .populate("category", "nameEn nameVi slugEn slugVi")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Question.countDocuments(filter),
    ]);

    // Gắn URL ký hạn cho attachments
    let out = questions.map(q => ({
      ...q.toObject(),
      attachments: q.attachments.map(a => ({
        key: a.key,
        mimeType: a.mimeType,
        url: getSignedS3Url(a.key),
      })),
    }));

    // ✅ Gắn thêm isSaved cho từng question
    out = await attachIsSaved(out, req.user?.id, "question");

    res.json({
      questions: out,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error("[Q&A] listPublishedQuestions error:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
}

/* ==========================
   6️⃣ Xem chi tiết câu hỏi (kèm câu trả lời)
========================== */
async function getQuestionDetail(req, res) {
  try {
    const { id } = req.params;

    const question = await Question.findById(id)
      .populate("createdBy", "name email")
      .populate("category", "nameEn nameVi slugEn slugVi");

    if (!question || question.status !== "published")
      return res.status(404).json({ message: "Không tìm thấy câu hỏi" });

    const answers = await Answer.find({
      question: id,
      status: "published",
    })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    // Chuẩn hóa output
    let questionOut = {
      ...question.toObject(),
      attachments: question.attachments.map(a => ({
        key: a.key,
        mimeType: a.mimeType,
        url: getSignedS3Url(a.key),
      })),
    };

    const answersOut = answers.map(a => ({
      ...a.toObject(),
      attachments: a.attachments.map(f => ({
        key: f.key,
        mimeType: f.mimeType,
        url: getSignedS3Url(f.key),
      })),
    }));

    // ✅ Gắn isSaved cho chính câu hỏi (không áp dụng cho answers)
    const [questionWithSaved] = await attachIsSaved([questionOut], req.user?.id, "question");

    res.json({ question: questionWithSaved, answers: answersOut });
  } catch (err) {
    console.error("[Q&A] getQuestionDetail error:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
}

/* ==========================
   7️⃣ Danh sách câu hỏi & câu trả lời của bản thân
========================== */
async function listMyQA(req, res) {
  try {
    const [questions, answers] = await Promise.all([
      Question.find({ createdBy: req.user.id }).sort({ createdAt: -1 }),
      Answer.find({ createdBy: req.user.id })
        .populate("question", "title status")
        .sort({ createdAt: -1 }),
    ]);

    // ✅ Gắn isSaved cho questions (answers để nguyên)
    const questionsOut = await attachIsSaved(questions.map(q => q.toObject()), req.user.id, "question");

    res.json({ questions: questionsOut, answers });
  } catch (err) {
    console.error("[Q&A] listMyQA error:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
}

module.exports = {
  createQuestion,
  updateQuestionStatus,
  createAnswer,
  updateAnswerStatus,
  listPublishedQuestions,
  getQuestionDetail,
  listMyQA,
};
