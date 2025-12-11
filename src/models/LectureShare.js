// models/LectureShare.js
const mongoose = require("mongoose");

const lectureShareSchema = new mongoose.Schema(
  {
    lecture: { type: mongoose.Schema.Types.ObjectId, ref: "Lecture", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Unique index để tránh share trùng cùng lecture + user
lectureShareSchema.index({ lecture: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("LectureShare", lectureShareSchema);
