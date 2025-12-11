const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    content: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { 
    timestamps: true // Tự động thêm createdAt, updatedAt
  }
);


module.exports = mongoose.model("Contact", contactSchema);
