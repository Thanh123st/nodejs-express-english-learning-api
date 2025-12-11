// models/DocumentShare.js
const mongoose = require("mongoose");

const documentShareSchema = new mongoose.Schema(
  {
    document: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true } // tự tạo createdAt, updatedAt
);

// Unique index để tránh share trùng cùng document + user
documentShareSchema.index({ document: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("DocumentShare", documentShareSchema);
