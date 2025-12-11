const mongoose = require("mongoose");

const lectureSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    publicId: { type: String, required: true }, // dùng để tạo signed URL
    mimeType: { type: String }, // ví dụ: video/mp4
    fileSize: { type: Number }, // dung lượng bytes
    isPublic: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // 🔹 Chuyên mục (Category)
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },

    // 🔹 Từ khóa (mảng string)
    keywords: { type: [String], default: [] }
  },
  { timestamps: true }
);

// Index để tối ưu tìm kiếm
lectureSchema.index({ title: "text", description: "text", keywords: "text" });
lectureSchema.index({ category: 1, createdBy: 1, isPublic: 1 });

module.exports = mongoose.model("Lecture", lectureSchema);
