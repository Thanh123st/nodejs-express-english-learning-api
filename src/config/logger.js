const winston = require("winston");
require("winston-daily-rotate-file");

const isProduction = process.env.NODE_ENV === "production";

// 🎯 Định nghĩa định dạng log
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(
    info => `[${info.timestamp}] [${info.level.toUpperCase()}] ${info.message}`
  )
);

// 🎯 Cấu hình transport (nơi ghi log)
const transports = [];

if (!isProduction) {
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: "logs/app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d", // giữ 14 ngày
      level: "info",
    })
  );
}

// ✅ Dù local hay Render: log ra console
transports.push(
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  })
);

// 🎯 Khởi tạo logger chính
const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  format: logFormat,
  transports,
});

module.exports = logger;
