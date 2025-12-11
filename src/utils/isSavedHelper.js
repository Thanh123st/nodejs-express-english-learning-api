const SavedItem = require("../models/SavedItem");

/**
 * Gắn trường isSaved vào danh sách tài nguyên (documents, lectures, collections, questions)
 * @param {Array} items - danh sách object cần gắn isSaved
 * @param {ObjectId} userId - id người dùng hiện tại
 * @param {String} kind - "document" | "lecture" | "collection" | "question"
 */
async function attachIsSaved(items, userId, kind) {
  if (!userId || !Array.isArray(items) || !items.length) return items;

  const ids = items.map(i => i._id || i.id);
  const saved = await SavedItem.find({
    user: userId,
    kind,
    ref: { $in: ids },
  }).select("ref");

  const savedSet = new Set(saved.map(s => String(s.ref)));

  return items.map(i => ({
    ...i.toObject?.() || i,
    isSaved: savedSet.has(String(i._id)),
  }));
}

module.exports = { attachIsSaved };
