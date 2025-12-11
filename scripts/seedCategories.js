// scripts/seedCategories.js
require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");

const Category = require(path.join(__dirname, "../src/models/Category"));
const { slugify } = require(path.join(__dirname, "../src/utils/slugify"));

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/english_api";

async function connectMongo() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected");
}

/**
 * Đảm bảo slug là unique cho một field (slugEn hoặc slugVi)
 * Nếu baseSlug đã tồn tại -> thêm -2, -3, ...
 */
async function ensureUniqueSlug(field, baseSlug) {
  let candidate = baseSlug;
  let i = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await Category.exists({ [field]: candidate });
    if (!exists) return candidate;
    candidate = `${baseSlug}-${i++}`;
  }
}

/**
 * Upsert theo (nameEn, nameVi)
 * - Tạo slugEn/slugVi từ tên
 * - Đảm bảo unique slug (nếu bị trùng sẽ thêm hậu tố)
 * - Idempotent: chạy nhiều lần không tạo thêm
 */
async function upsertCategory({ nameEn, nameVi, description = "", keywords = [], isActive = true }) {
  if (!nameEn || !nameVi) throw new Error("nameEn & nameVi are required");

  // Chuẩn bị slug base
  const baseSlugEn = slugify(nameEn);
  const baseSlugVi = slugify(nameVi);

  // Tìm doc có cặp tên này chưa
  let doc = await Category.findOne({ nameEn, nameVi });

  let slugEn, slugVi;

  if (doc) {
    // Nếu đã có, giữ slug hiện tại nếu có; nếu thiếu thì tạo mới + ensure unique
    if (!doc.slugEn) {
      slugEn = await ensureUniqueSlug("slugEn", baseSlugEn);
      doc.slugEn = slugEn;
    }
    if (!doc.slugVi) {
      slugVi = await ensureUniqueSlug("slugVi", baseSlugVi);
      doc.slugVi = slugVi;
    }

    // Cập nhật các field còn lại
    doc.description = description;
    doc.keywords = keywords;
    doc.isActive = isActive;

    await doc.save();
    return doc._id;
  }

  // Nếu chưa có -> tạo mới với slug unique
  slugEn = await ensureUniqueSlug("slugEn", baseSlugEn);
  slugVi = await ensureUniqueSlug("slugVi", baseSlugVi);

  doc = await Category.create({
    nameEn,
    nameVi,
    slugEn,
    slugVi,
    description,
    keywords,
    isActive
  });
  return doc._id;
}

async function run() {
  await connectMongo();

  try {
    const payloads = [
      {
        nameEn: "Core TOEIC Vocabulary",
        nameVi: "Danh sách Từ vựng TOEIC Chủ yếu",
        description: "Essential TOEIC vocabulary for test preparation.",
        keywords: ["toeic", "vocabulary", "core", "600 words"]
      },
      {
        nameEn: "Basic English Grammar",
        nameVi: "Ngữ pháp Tiếng Anh Cơ bản",
        description: "Grammar foundations: tenses, parts of speech, sentence structure.",
        keywords: ["grammar", "basic", "tenses", "parts of speech"]
      },
      {
        nameEn: "English Listening Practice",
        nameVi: "Luyện nghe Tiếng Anh",
        description: "Listening skills for everyday English and TOEIC.",
        keywords: ["listening", "toeic", "short talks", "conversations"]
      },
      {
        nameEn: "English Speaking Basics",
        nameVi: "Kỹ năng Nói tiếng Anh Cơ bản",
        description: "Pronunciation, fluency, and everyday speaking patterns.",
        keywords: ["speaking", "pronunciation", "fluency"]
      },
      {
        nameEn: "Reading Comprehension",
        nameVi: "Đọc hiểu Tiếng Anh",
        description: "Improve comprehension and inference skills.",
        keywords: ["reading", "comprehension", "inference"]
      },
      {
        nameEn: "Writing Skills",
        nameVi: "Kỹ năng Viết",
        description: "Paragraphs, essays, email writing.",
        keywords: ["writing", "essays", "email"]
      },
      {
        nameEn: "Pronunciation & Phonetics",
        nameVi: "Ngữ âm & Phát âm",
        description: "IPA, word stress, sentence stress.",
        keywords: ["pronunciation", "IPA", "phonetics", "stress"]
      },
      // Một vài chuyên mục con theo phong cách phẳng (vì schema hiện tại không có parent)
      {
        nameEn: "TOEIC 600 Essential Words",
        nameVi: "600 Từ TOEIC Cốt lõi",
        description: "The 600 most frequent TOEIC words.",
        keywords: ["toeic", "600 words", "vocabulary"]
      },
      {
        nameEn: "Tenses Overview",
        nameVi: "Tổng quan Thì",
        description: "Present, past, future, perfect, continuous.",
        keywords: ["tenses", "overview", "grammar"]
      },
      {
        nameEn: "Parts of Speech",
        nameVi: "Từ loại",
        description: "Nouns, verbs, adjectives, adverbs, prepositions.",
        keywords: ["parts of speech", "grammar"]
      },
      {
        nameEn: "Short Talks",
        nameVi: "Bài nói ngắn",
        description: "TOEIC Part 4 style listening.",
        keywords: ["listening", "short talks", "toeic"]
      },
      {
        nameEn: "Conversations",
        nameVi: "Hội thoại",
        description: "Dialogues and everyday conversations.",
        keywords: ["listening", "conversations"]
      }
    ];

    for (const p of payloads) {
      await upsertCategory(p);
    }

    console.log("✅ Seed categories finished.");
  } catch (err) {
    console.error("❌ Seed error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 MongoDB disconnected");
  }
}

run();
