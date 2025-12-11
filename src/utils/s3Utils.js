// utils/s3Utils.js
const { s3 } = require("../config/aws");

function getPresignedUrl(s3Key, expiresInSec = 3600) {
  return s3.getSignedUrl("getObject", {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: s3Key,
    Expires: expiresInSec,
  });
}

// Nếu muốn map array luôn
function mapDocumentsWithUrl(docs) {
  return docs.map(doc => ({
    _id: doc._id,
    title: doc.title,
    description: doc.description,
    fileUrl: getPresignedUrl(doc.s3Key),
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
  }));
}

module.exports = { getPresignedUrl, mapDocumentsWithUrl };
