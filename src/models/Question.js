const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    // Tiêu đề câu hỏi
    title: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 150,
      trim: true,
    },

    // Nội dung chi tiết
    content: {
      type: String,
      required: true,
      minlength: 30,
      trim: true,
    },

    // Danh sách thẻ (tags)
    tags: {
      type: [String],
      default: [],
    },

    // Danh mục (nếu có)
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    // File đính kèm (ảnh, pdf, audio,...)
    attachments: [
      {
        key: { type: String, required: true }, // S3 key
        mimeType: { type: String },
      },
    ],

    // Người tạo câu hỏi
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Trạng thái hiển thị
    status: {
      type: String,
      enum: ["published", "pending", "hidden", "deleted"],
      default: "published",
      index: true,
    },

    // Tổng số câu trả lời (tăng giảm khi có thêm/xoá answer)
    answersCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  }
);

// 🔍 Index hỗ trợ tìm kiếm
questionSchema.index({ title: "text", content: "text" });

// 🔍 Index phụ để lọc nhanh theo người tạo và thời gian cập nhật
questionSchema.index({ createdBy: 1, updatedAt: -1 });

module.exports = mongoose.model("Question", questionSchema);
