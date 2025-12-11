const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    s3Key: { type: String, required: true }, // key trong S3 bucket
    mimeType: { type: String },
    fileSize: { type: Number },
    isPublic: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // 🔹 Chuyên mục (Category)
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },

    // 🔹 Từ khóa (mảng string)
    keywords: { type: [String], default: [] }
  },
  { timestamps: true }
);

// Index để tìm kiếm nhanh
documentSchema.index({ title: "text", description: "text", keywords: "text" });
documentSchema.index({ category: 1, createdBy: 1, isPublic: 1 });

module.exports = mongoose.model("Document", documentSchema);
