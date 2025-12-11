// utils/userUtils.js
const User = require("../models/User");

// Lấy thông tin cơ bản của user theo _id
async function getUserInfo(userId) {
  if (!userId) return null;
  const user = await User.findById(userId, "name email");
  return user;
}

module.exports = { getUserInfo };
