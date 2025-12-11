const express = require("express");
const router = express.Router();
const multer = require("multer");
const verifyToken = require("../middleware/verifyToken");
const upload = multer({ storage: multer.memoryStorage() });

const {
  createCollection,
  updateCollection,
  deleteCollection,
  addItems,
  removeItem,
  reorderItems,
  getCollectionById,
  listCollections,
} = require("../controllers/collectionController");

// List collections (public) hoặc của tôi (?mine=true)
router.get("/", verifyToken, listCollections);

// Get chi tiết 1 collection (kèm signed URLs)
router.get("/:id", verifyToken, getCollectionById);

// Create / Update (nhận file ảnh cover qua field "cover")
router.post("/", verifyToken, upload.single("cover"), createCollection);
router.put("/:id", verifyToken, upload.single("cover"), updateCollection);

// Delete collection
router.delete("/:id", verifyToken, deleteCollection);

// Items
router.post("/:id/items", verifyToken, addItems); // thêm nhiều items
// xoá item theo ref id + query ?kind=lecture|document
router.delete("/:id/items/:itemId", verifyToken, removeItem);
// reorder items theo kind
router.post("/:id/items/reorder", verifyToken, reorderItems);

module.exports = router;