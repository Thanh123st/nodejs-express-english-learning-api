// src/utils/keywordTracker.js
const Keyword = require("../models/Keyword");

/** Parse "toeic,listening" OR '["toeic","listening"]' -> ["toeic","listening"] */
function parseKeywords(input) {
  if (Array.isArray(input)) return input.map(s => String(s).trim()).filter(Boolean);
  if (typeof input !== "string") return [];
  const t = input.trim();
  if (!t) return [];
  if (t.startsWith("[")) {
    try {
      const arr = JSON.parse(t);
      return Array.isArray(arr) ? arr.map(s => String(s).trim()).filter(Boolean) : [];
    } catch { /* fall back to CSV */ }
  }
  return t.split(",").map(s => s.trim()).filter(Boolean);
}

/** Chuẩn hoá: lowercase, bỏ dấu, chỉ giữ a-z0-9 và khoảng trắng, co về 1 space */
function normalizeKeyword(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tạo danh sách duy nhất theo normalized */
function toUniqueNormalizedPairs(rawArray = []) {
  const seen = new Set();
  const out = [];
  for (const raw of rawArray) {
    const name = String(raw || "").trim();
    if (!name) continue;
    const normalized = normalizeKeyword(name);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({ name, normalized });
  }
  return out;
}

/** Map type -> field usage */
function usageField(type) {
  if (type === "lecture") return "usage.lecture";
  if (type === "document") return "usage.document";
  if (type === "collection") return "usage.collection";
  throw new Error("Invalid keyword type. Use 'lecture' or 'document' or 'collection'.");
}

/** Tăng usage khi tạo mới (create) */
async function recordOnCreate(type, rawKeywords = []) {
  const items = toUniqueNormalizedPairs(rawKeywords);
  if (!items.length) return;
  const now = new Date();
  const field = usageField(type);

  const ops = items.map(({ name, normalized }) => ({
    updateOne: {
      filter: { normalized },
      update: {
        $setOnInsert: { name, normalized, firstSeenAt: now, isActive: true },
        $set: { lastUsedAt: now },
        $inc: { "usage.total": 1, [field]: 1 }
      },
      upsert: true
    }
  }));

  await Keyword.bulkWrite(ops, { ordered: false });
}

/** Tính delta keywords giữa mảng cũ và mới (dựa trên normalized) */
function computeDelta(oldArr = [], newArr = []) {
  const oldSet = new Set(oldArr.map(normalizeKeyword).filter(Boolean));
  const newSet = new Set(newArr.map(normalizeKeyword).filter(Boolean));

  const added = [...newSet].filter(k => !oldSet.has(k));   // normalized
  const removed = [...oldSet].filter(k => !newSet.has(k)); // normalized
  return { added, removed };
}

/** Áp dụng delta (update): cộng cho added, trừ cho removed */
async function applyDelta(type, delta = { added: [], removed: [] }) {
  const now = new Date();
  const field = usageField(type);
  const ops = [];

  for (const normalized of delta.added || []) {
    ops.push({
      updateOne: {
        filter: { normalized },
        update: {
          $setOnInsert: { name: normalized, normalized, firstSeenAt: now, isActive: true },
          $set: { lastUsedAt: now },
          $inc: { "usage.total": 1, [field]: 1 }
        },
        upsert: true
      }
    });
  }

  for (const normalized of delta.removed || []) {
    ops.push({
      updateOne: {
        filter: { normalized },
        update: {
          $set: { lastUsedAt: now },
          $inc: { "usage.total": -1, [field]: -1 }
        }
      }
    });
  }

  if (ops.length) await Keyword.bulkWrite(ops, { ordered: false });
  // dọn những keyword hết usage
  await Keyword.deleteMany({ "usage.total": { $lte: 0 } });
}

/** Giảm usage khi xoá doc/lec */
async function recordOnDelete(type, rawKeywords = []) {
  const items = toUniqueNormalizedPairs(rawKeywords);
  if (!items.length) return;
  const now = new Date();
  const field = usageField(type);

  const ops = items.map(({ normalized }) => ({
    updateOne: {
      filter: { normalized },
      update: {
        $set: { lastUsedAt: now },
        $inc: { "usage.total": -1, [field]: -1 }
      }
    }
  }));

  await Keyword.bulkWrite(ops, { ordered: false });
  await Keyword.deleteMany({ "usage.total": { $lte: 0 } });
}

module.exports = {
  parseKeywords,
  normalizeKeyword,
  computeDelta,
  recordOnCreate,
  applyDelta,
  recordOnDelete,
};
