const Lecture = require("../models/Lecture");
const Category = require("../models/Category");
const stream = require("stream");
const cloudinary = require("../config/cloudinary");
const { getSignedUrlCloudinary } = require("../utils/lectureUtils");

const {
  parseKeywords,
  computeDelta,
  recordOnCreate,
  applyDelta,
  recordOnDelete,
} = require("../utils/keywordTracker");
const { attachIsSaved } = require("../utils/isSavedHelper");
/* -------------------- Upload Cloudinary -------------------- */
function uploadVideoToCloudinary(fileBuffer, mimeType) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "lectures",
        type: "authenticated",
        format: mimeType?.split("/")[1] || undefined,
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );

    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);
    bufferStream.pipe(uploadStream);
  });
}
/* ---------------------------------------------------------- */

/* -------------------- CREATE -------------------- */
async function createLecture(req, res) {
  try {
    const { title, description, category, isPublic } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No video file uploaded" });

    const keywords = parseKeywords(req.body.keywords); // text/JSON -> array

    // validate category (nếu có)
    let categoryId = category || null;
    if (categoryId) {
      const exists = await Category.exists({ _id: categoryId });
      if (!exists) return res.status(400).json({ message: "Invalid category" });
    }

    const result = await uploadVideoToCloudinary(file.buffer, file.mimetype);

    const lecture = await Lecture.create({
      title,
      description,
      publicId: result.public_id,
      mimeType: file.mimetype,
      fileSize: file.size,
      createdBy: req.user.id,
      isPublic: isPublic === "true" || isPublic === true,
      category: categoryId,
      keywords, // mảng string
    });

    // ✅ Thống kê keyword cho Lecture
    if (keywords.length) {
      await recordOnCreate("lecture", keywords);
    }

    res.status(201).json({ message: "Lecture created successfully", lecture });
  } catch (err) {
    console.error("[Lecture] Create error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/* -------------------- UPDATE -------------------- */
async function updateLecture(req, res) {
  try {
    const { id } = req.params;
    const { title, description, isPublic, category } = req.body;
    const file = req.file;

    const lecture = await Lecture.findById(id);
    if (!lecture) return res.status(404).json({ message: "Lecture not found" });
    if (lecture.createdBy.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    // upload file mới nếu có
    if (file) {
      await cloudinary.uploader.destroy(lecture.publicId, { resource_type: "video" });
      const result = await uploadVideoToCloudinary(file.buffer, file.mimetype);
      lecture.publicId = result.public_id;
      lecture.mimeType = file.mimetype;
      lecture.fileSize = file.size;
    }

    if (typeof title !== "undefined") lecture.title = title;
    if (typeof description !== "undefined") lecture.description = description;
    if (typeof isPublic !== "undefined")
      lecture.isPublic = isPublic === "true" || isPublic === true;

    // category
    if (typeof category !== "undefined") {
      if (category) {
        const exists = await Category.exists({ _id: category });
        if (!exists) return res.status(400).json({ message: "Invalid category" });
        lecture.category = category;
      } else {
        lecture.category = null;
      }
    }

    // keywords (có truyền thì mới xử lý delta)
    if (typeof req.body.keywords !== "undefined") {
      const oldKeywords = Array.isArray(lecture.keywords) ? lecture.keywords : [];
      const newKeywords = parseKeywords(req.body.keywords);
      const delta = computeDelta(oldKeywords, newKeywords);
      lecture.keywords = newKeywords;

      // ✅ áp dụng delta thống kê
      if (delta.added.length || delta.removed.length) {
        await applyDelta("lecture", delta);
      }
    }

    await lecture.save();
    res.json({ message: "Lecture updated successfully", lecture });
  } catch (err) {
    console.error("[Lecture] Update error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/* ==================== USER LECTURES ==================== */
async function getUserLectures(req, res) {
  try {
    const userId = req.user.id;

    const lectures = await Lecture.find({ createdBy: userId })
      .populate("createdBy", "name email")
      .populate("category", "nameEn nameVi slugEn slugVi")
      .sort({ createdAt: -1 });

    // Chuẩn hoá output
    let lecturesWithSignedUrl = lectures.map((lec) => ({
      _id: lec._id,
      title: lec.title,
      description: lec.description,
      videoUrl: getSignedUrlCloudinary(lec.publicId),
      mimeType: lec.mimeType,
      fileSize: lec.fileSize,
      isPublic: lec.isPublic,
      category: lec.category,
      keywords: lec.keywords,
      createdBy: lec.createdBy,
      createdAt: lec.createdAt,
      updatedAt: lec.updatedAt,
    }));

    // ✅ Gắn thêm isSaved cho mỗi lecture
    lecturesWithSignedUrl = await attachIsSaved(lecturesWithSignedUrl, userId, "lecture");

    res.json({ lectures: lecturesWithSignedUrl });
  } catch (err) {
    console.error("[Lecture] Get user lectures error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/* ==================== PUBLIC LECTURES ==================== */
async function getPublicLectures(req, res) {
  try {
    const { category } = req.query;
    const filter = { isPublic: true };

    if (category) {
      const exists = await Category.exists({ _id: category });
      if (!exists) return res.status(400).json({ message: "Invalid category" });
      filter.category = category;
    }

    const lectures = await Lecture.find(filter)
      .populate("createdBy", "name email")
      .populate("category", "nameEn nameVi slugEn slugVi")
      .sort({ createdAt: -1 });

    let lecturesWithSignedUrl = lectures.map((lec) => ({
      _id: lec._id,
      title: lec.title,
      description: lec.description,
      videoUrl: getSignedUrlCloudinary(lec.publicId),
      mimeType: lec.mimeType,
      fileSize: lec.fileSize,
      isPublic: lec.isPublic,
      category: lec.category,
      keywords: lec.keywords,
      createdBy: lec.createdBy,
      createdAt: lec.createdAt,
      updatedAt: lec.updatedAt,
    }));

    // ✅ Gắn isSaved nếu người dùng có đăng nhập
    lecturesWithSignedUrl = await attachIsSaved(lecturesWithSignedUrl, req.user?.id, "lecture");

    res.json({ lectures: lecturesWithSignedUrl });
  } catch (err) {
    console.error("[Lecture] Get public lectures error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/* -------------------- DELETE -------------------- */
async function deleteLecture(req, res) {
  try {
    const { id } = req.params;

    const lecture = await Lecture.findById(id);
    if (!lecture) return res.status(404).json({ message: "Lecture not found" });
    if (lecture.createdBy.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    // ✅ Giảm thống kê keyword trước khi xoá
    const kws = Array.isArray(lecture.keywords) ? lecture.keywords : [];
    if (kws.length) {
      await recordOnDelete("lecture", kws);
    }

    // Xoá video khỏi Cloudinary
    try {
      await cloudinary.uploader.destroy(lecture.publicId, { resource_type: "video" });
    } catch (e) {
      console.error("[Cloudinary] destroy error:", e?.message || e);
      // vẫn tiếp tục xoá DB để không chặn flow
    }

    await lecture.deleteOne();
    res.json({ message: "Lecture deleted successfully" });
  } catch (err) {
    console.error("[Lecture] Delete error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

module.exports = {
  createLecture,
  getUserLectures,
  updateLecture,
  deleteLecture,
  getPublicLectures,
};
