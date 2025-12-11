const mongoose = require("mongoose");

const collectionItemSchema = new mongoose.Schema(
  {
    // chỉ hai loại: lecture | document
    kind: { type: String, enum: ["lecture", "document"], required: true },
    // tham chiếu tới Lecture._id hoặc Document._id
    ref: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    // thứ tự hiển thị trong tuyển tập
    order: { type: Number, default: 0 },
    // tiêu đề hiển thị thay thế (nếu muốn khác với bản gốc)
    titleOverride: { type: String },
    // ghi chú ngắn cho mục này (optional)
    note: { type: String }
  },
  { _id: false }
);

const collectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },

    // gom nhóm theo category sẵn có (optional)
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },

    // từ khoá dạng text (không bắt buộc track thống kê)
    keywords: { type: [String], default: [] },

    // ảnh cover (Cloudinary URL hoặc URL bất kỳ)
    coverPublicId: { type: String },

    // công khai hay nội bộ
    isPublic: { type: Boolean, default: false },

    // người tạo
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // danh sách mục (lecture/document)
    items: { type: [collectionItemSchema], default: [] },

    // số liệu cơ bản để render nhanh
    stats: {
      lectures: { type: Number, default: 0 },
      documents: { type: Number, default: 0 },
      totalItems: { type: Number, default: 0 }
    },

    // tiện ích: ghim (pin) / nổi bật (featured)
    isPinned: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Index hữu ích
collectionSchema.index({ title: "text", description: "text", keywords: "text" });
collectionSchema.index({ createdBy: 1, createdAt: -1 });
collectionSchema.index({ isPublic: 1, createdAt: -1 });

// Chuẩn hoá thứ tự + cập nhật stats trước khi lưu
collectionSchema.pre("save", function (next) {
  const items = Array.isArray(this.items) ? this.items : [];
  const lectures = items.filter(i => i.kind === "lecture").length;
  const documents = items.filter(i => i.kind === "document").length;
  this.stats.lectures = lectures;
  this.stats.documents = documents;
  this.stats.totalItems = items.length;

  // sắp xếp và re-index order: 0..n-1
  this.items = items
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((x, idx) => ({ ...x.toObject(), order: idx }));

  next();
});

module.exports = mongoose.model("Collection", collectionSchema);
