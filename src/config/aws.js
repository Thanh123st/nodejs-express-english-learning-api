// config/aws.js
const AWS = require("aws-sdk");
const stream = require("stream");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Hàm upload file buffer lên S3
function uploadFileToS3(fileBuffer, fileName, mimeType) {
  return new Promise((resolve, reject) => {
    const pass = new stream.PassThrough();
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME, // bucket name
      Key: fileName, // ví dụ: documents/lesson1.pdf
      Body: pass,
      ContentType: mimeType,
    };

    s3.upload(params, (err, data) => {
      if (err) return reject(err);
      resolve(data); // data.Location là URL file
    });

    pass.end(fileBuffer);
  });
}

module.exports = { s3, uploadFileToS3 };
