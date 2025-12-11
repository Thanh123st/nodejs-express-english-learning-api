const Collection = require("../models/Collection");
const Category   = require("../models/Category");
const Lecture    = require("../models/Lecture");
const Document   = require("../models/Document");
const cloudinary = require("../config/cloudinary");
const stream     = require("stream");
const { s3 }     = require("../config/aws");
const { getSignedUrlCloudinary } = require("../utils/lectureUtils"); // dùng cho video lecture
const { attachIsSaved } = require("../utils/isSavedHelper");

// keyword tracker (đã hỗ trợ 'collection')
const {
  parseKeywords,     // text/JSON -> array
  computeDelta,      // so sánh old/new -> {added, removed} (normalized)
  recordOnCreate,    // cập nhật usage khi tạo
  applyDelta,        // cộng/trừ theo delta khi update
  recordOnDelete,    // giảm usage khi xoá
} = require("../utils/keywordTracker");

/* -------------------- Helpers -------------------- */
function isValidKind(kind) {
  return kind === "lecture" || kind === "document";
}

function signedS3Url(key) {
  return s3.getSignedUrl("getObject", {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Expires: 3600, // 1h
  });
}

// ký URL cho ảnh cover từ Cloudinary (authenticated image)
function getSignedCoverUrl(publicId, expiresInSec = 3600) {
  if (!publicId) return null;
  // Cloudinary SDK hỗ trợ sign_url + expire_at cho type: 'authenticated'
  return cloudinary.url(publicId, {
    type: "authenticated",
    resource_type: "image",
    secure: true,
    sign_url: true,
    expire_at: Math.floor(Date.now() / 1000) + expiresInSec
  });
}

// upload ảnh cover lên Cloudinary (authenticated)
function uploadCoverToCloudinary(fileBuffer, mimeType) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: "collections",
        type: "authenticated",
        format: mimeType?.split("/")[1] || undefined, // jpg, png, webp...
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);
    bufferStream.pipe(uploadStream);
  });
}
/* ------------------------------------------------- */

/* ==================== CREATE ==================== */
// POST /api/collections  (multer field: cover)
async function createCollection(req, res) {
  try {
    const { title, description, subtitle, category, isPublic } = req.body;
    const keywords = parseKeywords(req.body.keywords);
    const coverFile = req.file;

    let categoryId = category || null;
    if (categoryId) {
      const exists = await Category.exists({ _id: categoryId });
      if (!exists) return res.status(400).json({ message: "Invalid category" });
    }

    let coverPublicId = undefined;
    if (coverFile) {
      const result = await uploadCoverToCloudinary(coverFile.buffer, coverFile.mimetype);
      coverPublicId = result.public_id;
    }

    const collection = await Collection.create({
      title,
      subtitle,
      description,
      category: categoryId,
      isPublic: isPublic === "true" || isPublic === true,
      // Model mới: coverPublicId
      coverPublicId,
      // nếu model cũ còn coverImageUrl, bạn có thể giữ thêm field này để tương thích
      createdBy: req.user.id,
      keywords,
      items: [], // trống ban đầu
    });

    // thống kê keyword vào bucket 'collection'
    if (keywords.length) {
      await recordOnCreate("collection", keywords);
    }

    res.status(201).json({ message: "Collection created", collection });
  } catch (err) {
    console.error("[Collection] Create error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/* ==================== UPDATE META ==================== */
// PUT /api/collections/:id  (multer field: cover)
async function updateCollection(req, res) {
  try {
    const { id } = req.params;
    const { title, subtitle, description, category, isPublic } = req.body;
    const coverFile = req.file; // EXPECT: multer.single('cover')

    const newKeywordsProvided = typeof req.body.keywords !== "undefined";
    const newKeywords = newKeywordsProvided ? parseKeywords(req.body.keywords) : undefined;

    const col = await Collection.findById(id);
    if (!col) return res.status(404).json({ message: "Collection not found" });
    if (col.createdBy.toString() !== req.user.id) return res.status(403).json({ message: "Unauthorized" });

    if (typeof title !== "undefined") col.title = title;
    if (typeof subtitle !== "undefined") col.subtitle = subtitle;
    if (typeof description !== "undefined") col.description = description;
    if (typeof isPublic !== "undefined") col.isPublic = isPublic === "true" || isPublic === true;

    if (typeof category !== "undefined") {
      if (category) {
        const exists = await Category.exists({ _id: category });
        if (!exists) return res.status(400).json({ message: "Invalid category" });
        col.category = category;
      } else {
        col.category = null;
      }
    }

    // cập nhật cover (xoá ảnh cũ nếu có)
    if (coverFile) {
      try {
        if (col.coverPublicId) {
          await cloudinary.uploader.destroy(col.coverPublicId, { resource_type: "image" });
        }
      } catch (e) {
        console.error("[Cloudinary] destroy cover error:", e?.message || e);
      }
      const result = await uploadCoverToCloudinary(coverFile.buffer, coverFile.mimetype);
      col.coverPublicId = result.public_id;
    }

    // keywords delta (bucket 'collection')
    if (newKeywordsProvided) {
      const oldKeywords = Array.isArray(col.keywords) ? col.keywords : [];
      const delta = computeDelta(oldKeywords, newKeywords);
      col.keywords = newKeywords;

      if (delta.added.length || delta.removed.length) {
        await applyDelta("collection", delta);
      }
    }

    await col.save();
    res.json({ message: "Collection updated", collection: col });
  } catch (err) {
    console.error("[Collection] Update error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/* ==================== DELETE ==================== */
// DELETE /api/collections/:id
async function deleteCollection(req, res) {
  try {
    const { id } = req.params;
    const col = await Collection.findById(id);
    if (!col) return res.status(404).json({ message: "Collection not found" });
    if (col.createdBy.toString() !== req.user.id) return res.status(403).json({ message: "Unauthorized" });

    // giảm usage keyword trước khi xoá
    const kws = Array.isArray(col.keywords) ? col.keywords : [];
    if (kws.length) {
      await recordOnDelete("collection", kws);
    }

    // xoá cover trên Cloudinary nếu có (không bắt buộc nhưng gọn)
    if (col.coverPublicId) {
      try {
        await cloudinary.uploader.destroy(col.coverPublicId, { resource_type: "image" });
      } catch (e) {
        console.error("[Cloudinary] destroy cover error:", e?.message || e);
      }
    }

    await col.deleteOne();
    res.json({ message: "Collection deleted" });
  } catch (err) {
    console.error("[Collection] Delete error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/* ==================== ITEMS: ADD ==================== */
// POST /api/collections/:id/items
// body: { items: [{ kind: "lecture"|"document", ref: "<id>", order?, titleOverride?, note? }, ...] }
async function addItems(req, res) {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "Items must be a non-empty array" });
    }
    if (items.some(it => !isValidKind(it.kind) || !it.ref)) {
      return res.status(400).json({ message: "Each item requires valid kind and ref" });
    }

    const col = await Collection.findById(id);
    if (!col) return res.status(404).json({ message: "Collection not found" });
    if (col.createdBy.toString() !== req.user.id) return res.status(403).json({ message: "Unauthorized" });

    // validate tồn tại của ref
    for (const it of items) {
      const exists = it.kind === "lecture"
        ? await Lecture.exists({ _id: it.ref })
        : await Document.exists({ _id: it.ref });
      if (!exists) return res.status(400).json({ message: `Invalid ref for ${it.kind}` });
    }

    const currentMax = Math.max(-1, ...col.items.map(i => i.order ?? 0));
    let counter = currentMax + 1;
    for (const it of items) {
      col.items.push({
        kind: it.kind,
        ref: it.ref,
        order: typeof it.order === "number" ? it.order : counter++,
        titleOverride: it.titleOverride || undefined,
        note: it.note || undefined,
      });
    }

    await col.save(); // pre-save reindex + stats
    res.json({ message: "Items added", collection: col });
  } catch (err) {
    console.error("[Collection] Add items error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/* ==================== ITEMS: REMOVE ==================== */
// DELETE /api/collections/:id/items/:itemId?kind=lecture|document
// itemId = ObjectId của Lecture/Document (tức là ref)
async function removeItem(req, res) {
  try {
    const { id, itemId } = req.params;
    const { kind } = req.query;

    if (!isValidKind(kind)) {
      return res.status(400).json({ message: "Invalid kind" });
    }

    const col = await Collection.findById(id);
    if (!col) return res.status(404).json({ message: "Collection not found" });
    if (col.createdBy.toString() !== req.user.id) return res.status(403).json({ message: "Unauthorized" });

    const before = col.items.length;
    col.items = col.items.filter(i => !(i.kind === kind && String(i.ref) === String(itemId)));
    if (col.items.length === before) {
      return res.status(404).json({ message: "Item not found in collection" });
    }

    await col.save(); // pre-save reindex + stats
    res.json({ message: "Item removed", collection: col });
  } catch (err) {
    console.error("[Collection] Remove item error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/* ==================== ITEMS: REORDER ==================== */
// POST /api/collections/:id/items/reorder
// body: { order: ["<refId1>", "<refId2>", ...], kind: "lecture"|"document" }
async function reorderItems(req, res) {
  try {
    const { id } = req.params;
    const { order, kind } = req.body;

    if (!Array.isArray(order) || !order.length) {
      return res.status(400).json({ message: "order must be non-empty array" });
    }
    if (!isValidKind(kind)) {
      return res.status(400).json({ message: "Invalid kind" });
    }

    const col = await Collection.findById(id);
    if (!col) return res.status(404).json({ message: "Collection not found" });
    if (col.createdBy.toString() !== req.user.id) return res.status(403).json({ message: "Unauthorized" });

    const subset = col.items.filter(i => i.kind === kind);
    if (subset.length !== order.length) {
      return res.status(400).json({ message: "order length mismatch with items of this kind" });
    }

    const map = new Map(subset.map(i => [String(i.ref), i]));
    for (const rid of order) {
      if (!map.has(String(rid))) {
        return res.status(400).json({ message: "order contains unknown ref id" });
      }
    }

    let idx = 0;
    col.items = col.items.map(i => {
      if (i.kind !== kind) return i;
      const it = map.get(String(i.ref));
      return { ...it.toObject(), order: idx++ };
    });

    await col.save(); // pre-save reindex + stats
    res.json({ message: "Items reordered", collection: col });
  } catch (err) {
    console.error("[Collection] Reorder items error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/* ==================== READ: DETAIL ==================== */
// GET /api/collections/:id
async function getCollectionById(req, res) {
  try {
    const { id } = req.params;

    const col = await Collection.findById(id)
      .populate("createdBy", "name email")
      .populate("category", "nameEn nameVi slugEn slugVi");

    if (!col) return res.status(404).json({ message: "Collection not found" });

    const coverUrl = getSignedCoverUrl(col.coverPublicId);

    const itemsOut = [];
    for (const it of col.items) {
      if (it.kind === "lecture") {
        const lec = await Lecture.findById(it.ref)
          .populate("category", "nameEn nameVi slugEn slugVi");
        if (!lec) continue;
        itemsOut.push({
          kind: "lecture",
          ref: lec._id,
          order: it.order,
          title: it.titleOverride || lec.title,
          note: it.note,
          description: lec.description,
          videoUrl: getSignedUrlCloudinary(lec.publicId),
          mimeType: lec.mimeType,
          fileSize: lec.fileSize,
          category: lec.category,
          keywords: lec.keywords,
        });
      } else {
        const doc = await Document.findById(it.ref)
          .populate("category", "nameEn nameVi slugEn slugVi");
        if (!doc) continue;
        itemsOut.push({
          kind: "document",
          ref: doc._id,
          order: it.order,
          title: it.titleOverride || doc.title,
          note: it.note,
          description: doc.description,
          fileUrl: signedS3Url(doc.s3Key),
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
          category: doc.category,
          keywords: doc.keywords,
        });
      }
    }

    const out = {
      _id: col._id,
      title: col.title,
      subtitle: col.subtitle,
      description: col.description,
      isPublic: col.isPublic,
      keywords: col.keywords,
      coverPublicId: col.coverPublicId,
      coverUrl,
      category: col.category,
      createdBy: col.createdBy,
      stats: col.stats,
      items: itemsOut.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      createdAt: col.createdAt,
      updatedAt: col.updatedAt,
    };

    // ✅ Gắn thêm isSaved cho collection hiện tại
    const [withSaved] = await attachIsSaved([out], req.user?.id, "collection");

    res.json({ collection: withSaved });
  } catch (err) {
    console.error("[Collection] Get by id error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/* ==================== READ: LIST ==================== */
// GET /api/collections?mine=true|false&category=&q=&page=&limit=
async function listCollections(req, res) {
  try {
    const { mine, category, q, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const filter = {};
    if (mine === "true") filter.createdBy = req.user.id;
    else filter.isPublic = true;

    if (category) filter.category = category;
    if (q && q.trim()) filter.title = { $regex: q.trim(), $options: "i" };

    const [items, total] = await Promise.all([
      Collection.find(filter)
        .populate("createdBy", "name email")
        .populate("category", "nameEn nameVi slugEn slugVi")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Collection.countDocuments(filter),
    ]);

    // Chuẩn hóa output
    const out = items.map(c => ({
      _id: c._id,
      title: c.title,
      subtitle: c.subtitle,
      description: c.description,
      isPublic: c.isPublic,
      keywords: c.keywords,
      coverPublicId: c.coverPublicId,
      coverUrl: getSignedCoverUrl(c.coverPublicId),
      category: c.category,
      createdBy: c.createdBy,
      stats: c.stats,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    // ✅ Gắn isSaved cho tất cả collection trả về
    const withSaved = await attachIsSaved(out, req.user?.id, "collection");

    res.json({
      collections: withSaved,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error("[Collection] List error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

module.exports = {
  createCollection,
  updateCollection,
  deleteCollection,
  addItems,
  removeItem,
  reorderItems,
  getCollectionById,
  listCollections,
};
