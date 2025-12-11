// models/Keyword.js
const mongoose = require("mongoose");

const keywordSchema = new mongoose.Schema(
  {
    // tên hiển thị
    name: { type: String, required: true, trim: true },

    // tên chuẩn hóa (lowercase, không dấu, không ký tự đặc biệt)
    normalized: { type: String, required: true, unique: true, index: true },

    // đếm tần suất xuất hiện
    usage: {
      total: { type: Number, default: 0 },
      lecture: { type: Number, default: 0 },
      document: { type: Number, default: 0 },
      collection: { type: Number, default: 0 }
    },

    firstSeenAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Keyword", keywordSchema);
