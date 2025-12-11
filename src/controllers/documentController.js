const Document = require("../models/Document");
const Category = require("../models/Category");
const { s3, uploadFileToS3 } = require("../config/aws");

const {
  parseKeywords,
  computeDelta,
  recordOnCreate,
  applyDelta,
  recordOnDelete,
} = require("../utils/keywordTracker");
const { attachIsSaved } = require("../utils/isSavedHelper");
/* -------------------- Helpers -------------------- */
function getSignedS3Url(key) {
  // Signed URL 1 giờ
  return s3.getSignedUrl("getObject", {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Expires: 3600,
  });
}
/* ------------------------------------------------- */

// Upload tài liệu mới
async function uploadDocument(req, res) {
  try {
    const { title, description, category, isPublic } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No document uploaded" });

    // parse keywords (text/JSON -> array)
    const keywords = parseKeywords(req.body.keywords);

    // validate category (nếu có)
    let categoryId = category || null;
    if (categoryId) {
      const exists = await Category.exists({ _id: categoryId });
      if (!exists) return res.status(400).json({ message: "Invalid category" });
    }

    const s3Key = `documents/${Date.now()}-${file.originalname}`;
    await uploadFileToS3(file.buffer, s3Key, file.mimetype);

    const doc = await Document.create({
      title,
      description,
      s3Key,
      mimeType: file.mimetype,
      fileSize: file.size,
      createdBy: req.user.id,
      isPublic: isPublic === "true" || isPublic === true,
      category: categoryId,
      keywords, // mảng string
    });

    // ✅ Thống kê keyword cho Document
    if (keywords.length) {
      await recordOnCreate("document", keywords);
    }

    res.status(201).json({ message: "Document uploaded", document: doc });
  } catch (err) {
    console.error("[Document] Upload error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// Sửa document
async function updateDocument(req, res) {
  try {
    const { id } = req.params;
    const { title, description, isPublic, category } = req.body;

    const doc = await Document.findById(id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // chỉ cho creator sửa
    if (doc.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // nếu có file mới thì upload lại
    if (req.file) {
      const s3Key = `documents/${Date.now()}-${req.file.originalname}`;
      await uploadFileToS3(req.file.buffer, s3Key, req.file.mimetype);
      doc.s3Key = s3Key;
      doc.mimeType = req.file.mimetype;
      doc.fileSize = req.file.size;
    }

    if (typeof title !== "undefined") doc.title = title;
    if (typeof description !== "undefined") doc.description = description;
    if (typeof isPublic !== "undefined")
      doc.isPublic = isPublic === "true" || isPublic === true;

    // category
    if (typeof category !== "undefined") {
      if (category) {
        const exists = await Category.exists({ _id: category });
        if (!exists) return res.status(400).json({ message: "Invalid category" });
        doc.category = category;
      } else {
        doc.category = null;
      }
    }

    // keywords (có truyền thì mới xử lý delta)
    if (typeof req.body.keywords !== "undefined") {
      const oldKeywords = Array.isArray(doc.keywords) ? doc.keywords : [];
      const newKeywords = parseKeywords(req.body.keywords);
      const delta = computeDelta(oldKeywords, newKeywords);
      doc.keywords = newKeywords;

      // ✅ áp dụng delta thống kê
      if (delta.added.length || delta.removed.length) {
        await applyDelta("document", delta);
      }
    }

    await doc.save();
    res.json({ message: "Document updated", document: doc });
  } catch (err) {
    console.error("[Document] Update error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// Xóa document (chỉ xóa trong database)
async function deleteDocument(req, res) {
  try {
    const { id } = req.params;

    const doc = await Document.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // chỉ cho người tạo được xóa
    if (doc.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // ✅ Giảm thống kê keyword trước khi xoá DB
    const kws = Array.isArray(doc.keywords) ? doc.keywords : [];
    if (kws.length) {
      await recordOnDelete("document", kws);
    }

    await doc.deleteOne(); // không đụng tới S3

    res.json({ message: "Document deleted successfully" });
  } catch (err) {
    console.error("[Document] Delete error:", err);
    res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
}

/* ==================== USER DOCUMENTS ==================== */
// GET /api/documents/mine
async function getUserDocuments(req, res) {
  try {
    const userId = req.user.id;

    const docs = await Document.find({ createdBy: userId })
      .populate("createdBy", "name email")
      .populate("category", "nameEn nameVi slugEn slugVi")
      .sort({ createdAt: -1 });

    // Chuẩn hoá output
    let docsWithUrl = docs.map(d => ({
      _id: d._id,
      title: d.title,
      description: d.description,
      fileUrl: getSignedS3Url(d.s3Key),
      mimeType: d.mimeType,
      fileSize: d.fileSize,
      isPublic: d.isPublic,
      category: d.category,
      keywords: d.keywords,
      createdBy: d.createdBy,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));

    // ✅ Gắn isSaved
    docsWithUrl = await attachIsSaved(docsWithUrl, userId, "document");

    res.json({ documents: docsWithUrl });
  } catch (err) {
    console.error("[Document] Get documents error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/* ==================== PUBLIC DOCUMENTS ==================== */
// GET /api/documents/public?category=...
async function getPublicDocuments(req, res) {
  try {
    const { category } = req.query;
    const filter = { isPublic: true };

    if (category) {
      const exists = await Category.exists({ _id: category });
      if (!exists) return res.status(400).json({ message: "Invalid category" });
      filter.category = category;
    }

    const docs = await Document.find(filter)
      .populate("createdBy", "name email")
      .populate("category", "nameEn nameVi slugEn slugVi")
      .sort({ createdAt: -1 });

    let docsWithUrl = docs.map(d => ({
      _id: d._id,
      title: d.title,
      description: d.description,
      fileUrl: getSignedS3Url(d.s3Key),
      mimeType: d.mimeType,
      fileSize: d.fileSize,
      isPublic: d.isPublic,
      category: d.category,
      keywords: d.keywords,
      createdBy: d.createdBy,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));

    // ✅ Gắn isSaved nếu người dùng đã đăng nhập
    docsWithUrl = await attachIsSaved(docsWithUrl, req.user?.id, "document");

    res.json({ documents: docsWithUrl });
  } catch (err) {
    console.error("[Document] Get public documents error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

module.exports = {
  uploadDocument,
  getUserDocuments,
  updateDocument,
  deleteDocument,
  getPublicDocuments,
};
