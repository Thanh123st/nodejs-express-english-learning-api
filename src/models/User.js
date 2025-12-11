// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    uid:   { type: String, required: true, unique: true, index: true }, // Firebase UID
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name:  { type: String, trim: true },
    photoURL: { type: String, default: null },

    role: {
      type: String,
      enum: ["news","user", "moderator", "admin"],
      default: "news",
      index: true,
    },

    isBanned: { type: Boolean, default: false },
  },
  { timestamps: true } // tự sinh createdAt, updatedAt
);

module.exports = mongoose.model("User", userSchema);
