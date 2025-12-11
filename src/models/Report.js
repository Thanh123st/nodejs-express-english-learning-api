const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ["question", "answer"],
      required: true,
      index: true,
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    reason: {
      type: String,
      enum: ["spam", "offensive", "irrelevant", "other"],
      required: true,
      index: true,
    },

    details: { type: String, trim: true },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["open", "reviewed", "actioned"],
      default: "open",
      index: true,
    },
  },
  { timestamps: true }
);

// Truy vấn phổ biến: các report đang mở theo đối tượng
reportSchema.index({ targetType: 1, targetId: 1, status: 1 });

module.exports = mongoose.model("Report", reportSchema);
