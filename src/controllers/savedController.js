const mongoose = require("mongoose");
const SavedItem = require("../models/SavedItem");
const Document = require("../models/Document");
const Lecture = require("../models/Lecture");
const Collection = require("../models/Collection");
const Question = require("../models/Question");
const { s3 } = require("../config/aws");
const cloudinary = require("../config/cloudinary");
const { getSignedUrlCloudinary } = require("../utils/lectureUtils");

// Validate kind
const ALLOWED_KINDS = new Set(["document", "lecture", "collection", "question"]);
function isValidKind(kind) {
  return ALLOWED_KINDS.has(kind);
}

// S3 signed URL (1h)
function getSignedS3Url(key) {
  return s3.getSignedUrl("getObject", {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Expires: 3600,
  });
}

// Cloudinary signed URL cho ảnh cover (type: authenticated)
function getSignedCoverUrl(publicId, expiresInSec = 3600) {
  if (!publicId) return null;
  return cloudinary.url(publicId, {
    type: "authenticated",
    resource_type: "image",
    secure: true,
    sign_url: true,
    expire_at: Math.floor(Date.now() / 1000) + expiresInSec,
  });
}

/* ==================== CREATE ==================== */
// POST /api/saved
// body: { kind: "document"|"lecture"|"collection"|"question", ref: "<ObjectId>" }
async function saveItem(req, res) {
  try {
    const { kind, ref } = req.body;

    if (!isValidKind(kind)) {
      return res.status(400).json({ message: "Invalid kind" });
    }
    if (!ref || !mongoose.Types.ObjectId.isValid(ref)) {
      return res.status(400).json({ message: "Invalid ref id" });
    }

    // Kiểm tra tồn tại của resource
    let exists = false;
    if (kind === "document") {
      exists = !!(await Document.exists({ _id: ref }));
    } else if (kind === "lecture") {
      exists = !!(await Lecture.exists({ _id: ref }));
    } else if (kind === "collection") {
      exists = !!(await Collection.exists({ _id: ref }));
    } else if (kind === "question") {
      exists = !!(await Question.exists({ _id: ref, status: "published" }));
    }
    if (!exists) return res.status(404).json({ message: "Resource not found" });

    // Tạo record (unique theo user+kind+ref)
    try {
      const saved = await SavedItem.create({
        user: req.user.id,
        kind,
        ref,
      });
      return res.status(201).json({ message: "Saved", saved });
    } catch (e) {
      if (e?.code === 11000) {
        return res.status(200).json({ message: "Already saved" });
      }
      throw e;
    }
  } catch (err) {
    console.error("[Saved] saveItem error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/* ==================== DELETE ==================== */
// DELETE /api/saved/:kind/:refId
async function removeSaved(req, res) {
  try {
    const { kind, refId } = req.params;

    if (!isValidKind(kind)) {
      return res.status(400).json({ message: "Invalid kind" });
    }
    if (!mongoose.Types.ObjectId.isValid(refId)) {
      return res.status(400).json({ message: "Invalid ref id" });
    }

    const result = await SavedItem.deleteOne({
      user: req.user.id,
      kind,
      ref: refId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Saved item not found" });
    }

    res.json({ message: "Removed from saved" });
  } catch (err) {
    console.error("[Saved] removeSaved error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/* ==================== LIST ==================== */
// GET /api/saved?kind=document|lecture|collection|question&page=1&limit=20
// ❗ Chỉ trả về resource đang public
async function listSaved(req, res) {
  try {
    const { kind, page = "1", limit = "20" } = req.query;

    if (kind && !isValidKind(kind)) {
      return res.status(400).json({ message: "Invalid kind" });
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const baseFilter = { user: req.user.id };
    if (kind) baseFilter.kind = kind;

    const [saved, total] = await Promise.all([
      SavedItem.find(baseFilter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      SavedItem.countDocuments(baseFilter),
    ]);

    // Gom theo kind để query theo batch
    const group = {
      document: [],
      lecture: [],
      collection: [],
      question: [],
    };
    for (const s of saved) {
      group[s.kind].push(s.ref);
    }

    // Query từng loại + map theo id
    const [docs, lecs, colls, ques] = await Promise.all([
      group.document.length
        ? Document.find({ _id: { $in: group.document } })
            .populate("category", "nameEn nameVi slugEn slugVi")
        : [],
      group.lecture.length
        ? Lecture.find({ _id: { $in: group.lecture } })
            .populate("category", "nameEn nameVi slugEn slugVi")
        : [],
      group.collection.length
        ? Collection.find({ _id: { $in: group.collection } })
            .populate("category", "nameEn nameVi slugEn slugVi")
            .populate("createdBy", "name email")
        : [],
      group.question.length
        ? Question.find({ _id: { $in: group.question }, status: "published" })
            .populate("createdBy", "name email")
            .populate("category", "nameEn nameVi slugEn slugVi")
        : [],
    ]);

    const docMap = new Map(docs.map(d => [String(d._id), d]));
    const lecMap = new Map(lecs.map(l => [String(l._id), l]));
    const colMap = new Map(colls.map(c => [String(c._id), c]));
    const quesMap = new Map(ques.map(q => [String(q._id), q]));

    // Build output và lọc theo isPublic/published
    const items = [];
    for (const s of saved) {
      if (s.kind === "document") {
        const d = docMap.get(String(s.ref));
        if (!d || !d.isPublic) continue;
        items.push({
          kind: "document",
          ref: d._id,
          title: d.title,
          description: d.description,
          fileUrl: getSignedS3Url(d.s3Key),
          mimeType: d.mimeType,
          fileSize: d.fileSize,
          category: d.category,
          keywords: d.keywords,
          isPublic: d.isPublic,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        });
      } else if (s.kind === "lecture") {
        const l = lecMap.get(String(s.ref));
        if (!l || !l.isPublic) continue;
        items.push({
          kind: "lecture",
          ref: l._id,
          title: l.title,
          description: l.description,
          videoUrl: getSignedUrlCloudinary(l.publicId),
          mimeType: l.mimeType,
          fileSize: l.fileSize,
          category: l.category,
          keywords: l.keywords,
          isPublic: l.isPublic,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
        });
      } else if (s.kind === "collection") {
        const c = colMap.get(String(s.ref));
        if (!c || !c.isPublic) continue;
        items.push({
          kind: "collection",
          ref: c._id,
          title: c.title,
          subtitle: c.subtitle,
          description: c.description,
          coverUrl: getSignedCoverUrl(c.coverPublicId),
          coverPublicId: c.coverPublicId,
          category: c.category,
          keywords: c.keywords,
          isPublic: c.isPublic,
          stats: c.stats,
          createdBy: c.createdBy,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        });
      } else if (s.kind === "question") {
        const q = quesMap.get(String(s.ref));
        if (!q || q.status !== "published") continue;
        items.push({
          kind: "question",
          ref: q._id,
          title: q.title,
          content: q.content,
          tags: q.tags,
          category: q.category,
          createdBy: q.createdBy,
          attachments: q.attachments?.map(a => ({
            key: a.key,
            mimeType: a.mimeType,
            url: getSignedS3Url(a.key),
          })),
          createdAt: q.createdAt,
          updatedAt: q.updatedAt,
        });
      }
    }

    res.json({
      items,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error("[Saved] listSaved error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

module.exports = { saveItem, removeSaved, listSaved };
