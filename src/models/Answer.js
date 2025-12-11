const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },

    content: {
      type: String,
      required: true,
      minlength: 10,   // tùy chỉnh
      trim: true,
    },

    // Đính kèm (nếu có)
    attachments: [
      {
        key: { type: String, required: true }, // S3 key
        mimeType: { type: String },
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["published", "pending", "hidden", "deleted"],
      default: "published",
      index: true,
    },
  },
  { timestamps: true }
);

// Gợi ý index để load nhanh danh sách câu trả lời theo câu hỏi
answerSchema.index({ question: 1, createdAt: -1 });

module.exports = mongoose.model("Answer", answerSchema);
