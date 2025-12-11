// utils/lectureUtils.js
const cloudinary = require("../config/cloudinary"); 

/**
 * Tạo signed URL cho video Cloudinary (authenticated)
 * @param {string} publicId - public_id của video
 * @param {number} expires - thời gian sống (giây), default 3600s
 */
function getSignedUrlCloudinary(publicId, expires = 3600) {
  if (!publicId) return null; // an toàn nếu publicId chưa có
  return cloudinary.url(publicId, {
    resource_type: "video",
    type: "authenticated",
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + expires,
  });
}

module.exports = { getSignedUrlCloudinary };
