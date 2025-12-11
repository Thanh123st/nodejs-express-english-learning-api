const mongoose = require("mongoose");
const { slugify } = require("../utils/slugify"); // nhớ tạo utils/slugify.js

const categorySchema = new mongoose.Schema(
  {
    // Ví dụ: "Core TOEIC Vocabulary" / "Danh sách Từ vựng TOEIC Chủ yếu"
    nameEn: { type: String, required: true, trim: true },
    nameVi: { type: String, required: true, trim: true },

    slugEn: { type: String, unique: true, index: true },
    slugVi: { type: String, unique: true, index: true },

    description: { type: String },

    // Từ khóa gợi ý thêm cho category (tags nhanh)
    keywords: { type: [String], default: [] },

    // Quản lý trạng thái
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Chỉ mục để tìm kiếm nhanh
categorySchema.index({ nameEn: 1, nameVi: 1 }, { unique: true });
categorySchema.index({ nameEn: "text", nameVi: "text", description: "text", keywords: "text" });

// Tự động tạo slug khi save
categorySchema.pre("save", function (next) {
  if (!this.slugEn && this.nameEn) this.slugEn = slugify(this.nameEn);
  if (!this.slugVi && this.nameVi) this.slugVi = slugify(this.nameVi);
  next();
});

module.exports = mongoose.model("Category", categorySchema);
