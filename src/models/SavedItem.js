// models/SavedItem.js
const mongoose = require("mongoose");

const savedItemSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Loại nội dung được lưu
    kind: {
      type: String,
      enum: ["question", "document", "lecture", "collection"],
      required: true,
      index: true,
    },

    // ID tham chiếu đến bảng tương ứng
    ref: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

  },
  { timestamps: true }
);

// Tránh trùng lặp lưu cùng 1 item
savedItemSchema.index({ user: 1, kind: 1, ref: 1 }, { unique: true });

module.exports = mongoose.model("SavedItem", savedItemSchema);
