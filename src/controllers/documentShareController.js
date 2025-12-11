// controllers/documentShareController.js
const DocumentShare = require("../models/DocumentShare");
const Document = require("../models/Document");
const mongoose = require("mongoose");
const { getPresignedUrl } = require("../utils/s3Utils");
const { getUserInfo } = require("../utils/userUtils");
// Share document với user
async function createShare(req, res) {
  try {
    const { documentId, userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(documentId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid documentId or userId" });
    }

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // Chỉ owner mới được share
    if (doc.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to share this document" });
    }

    const share = new DocumentShare({
      document: documentId,
      user: userId,
    });

    await share.save();
    res.status(201).json({ message: "Document shared successfully", share });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "This document has already been shared with this user" });
    }
    console.error("[DocumentShare] Create error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// Lấy danh sách document share cho user
async function getSharedDocuments(req, res) {
    try {
      const userId = req.user.id;
  
      const shares = await DocumentShare.find({ user: userId })
        .populate("document")
        .sort({ createdAt: -1 });
  
      const sharedDocs = await Promise.all(
        shares.map(async (s) => {
          const owner = await getUserInfo(s.document.createdBy); // await ở đây
          return {
            _id: s.document._id,
            title: s.document.title,
            description: s.document.description,
            fileUrl: getPresignedUrl(s.document.s3Key),
            mimeType: s.document.mimeType,
            fileSize: s.document.fileSize,
            sharedAt: s.createdAt,
            createdBy: owner, // { _id, name, email }
          };
        })
      );
  
      res.json({ documents: sharedDocs });
    } catch (err) {
      console.error("[DocumentShare] Get shared documents error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }

// Hủy share
async function deleteShare(req, res) {
  try {
    const { id } = req.params; // id của documentShare

    const share = await DocumentShare.findById(id).populate("document");
    if (!share) return res.status(404).json({ message: "Share not found" });

    // Chỉ owner document mới được xóa share
    if (share.document.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to delete this share" });
    }

    await share.deleteOne();
    res.json({ message: "Share deleted successfully" });
  } catch (err) {
    console.error("[DocumentShare] Delete share error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}


// --- Mới: Lấy danh sách user được share cho 1 document ---
async function getSharesByDocument(req, res) {
  try {
    const { documentId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ message: "Invalid documentId" });
    }

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // Chỉ owner mới xem được danh sách share
    if (doc.createdBy.toString() !== userId) {
      return res.status(403).json({ message: "Not authorized to view shares for this document" });
    }

    const shares = await DocumentShare.find({ document: documentId }).sort({ createdAt: -1 });

    const users = await Promise.all(
      shares.map(async (s) => {
        const user = await getUserInfo(s.user);
        return {
          _id: s.user,
          name: user?.name || null,
          email: user?.email || null,
          sharedAt: s.createdAt,
        };
      })
    );

    res.json({ documentId, sharedUsers: users });
  } catch (err) {
    console.error("[DocumentShare] Get shares by document error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

module.exports = {
  createShare,
  getSharedDocuments,
  deleteShare,
  getSharesByDocument,
};
