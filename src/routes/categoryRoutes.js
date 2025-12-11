// src/routes/categoryRoutes.js
const express = require("express");
const router = express.Router();
const Category = require("../models/Category");

/**
 * GET /api/categories
 * Query:
 *  - q: text search (nameEn/nameVi/description/keywords)
 *  - active: true|false (mặc định chỉ trả isActive=true)
 *  - page: số trang (mặc định 1)
 *  - limit: số item/trang (mặc định 20)
 */
router.get("/", async (req, res) => {
  try {
    const {
      q = "",
      active = "true",
      page = "1",
      limit = "20",
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const filter = {};
    if (active === "true") filter.isActive = true;
    else if (active === "false") filter.isActive = false;

    if (q && q.trim()) {
      // dùng text index đã tạo trong model (nameEn/nameVi/description/keywords)
      filter.$text = { $search: q.trim() };
    }

    const [items, total] = await Promise.all([
      Category.find(filter)
        .select("nameEn nameVi slugEn slugVi description keywords isActive createdAt updatedAt")
        .sort(q ? { score: { $meta: "textScore" } } : { createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Category.countDocuments(filter),
    ]);

    res.json({
      categories: items,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error("[Category] List error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * GET /api/categories/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id)
      .select("nameEn nameVi slugEn slugVi description keywords isActive createdAt updatedAt");
  if (!cat) return res.status(404).json({ message: "Category not found" });
    res.json({ category: cat });
  } catch (err) {
    console.error("[Category] Get by id error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * GET /api/categories/by-slug/:slug
 *  - Tìm theo slugEn hoặc slugVi
 */
router.get("/by-slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const cat = await Category.findOne({
      $or: [{ slugEn: slug }, { slugVi: slug }],
    }).select("nameEn nameVi slugEn slugVi description keywords isActive createdAt updatedAt");

    if (!cat) return res.status(404).json({ message: "Category not found" });
    res.json({ category: cat });
  } catch (err) {
    console.error("[Category] Get by slug error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
