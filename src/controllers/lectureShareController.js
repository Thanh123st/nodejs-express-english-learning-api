// controllers/lectureShareController.js
const LectureShare = require("../models/LectureShare");
const Lecture = require("../models/Lecture");
const { getUserInfo } = require("../utils/userUtils");
const { getSignedUrlCloudinary } = require("../utils/lectureUtils");
// Share bài giảng với user
async function createShare(req, res) {
  try {
    const { lectureId, userId } = req.body;

    if (!lectureId || !userId) {
      return res.status(400).json({ message: "lectureId and userId are required" });
    }

    const lecture = await Lecture.findById(lectureId);
    if (!lecture) return res.status(404).json({ message: "Lecture not found" });

    // Chỉ owner mới được share
    if (lecture.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to share this lecture" });
    }

    const share = new LectureShare({ lecture: lectureId, user: userId });
    await share.save();

    res.status(201).json({ message: "Lecture shared successfully", share });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "This lecture has already been shared with this user" });
    }
    console.error("[LectureShare] Create error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// Lấy danh sách bài giảng share cho user
async function getSharedLectures(req, res) {
    try {
        const userId = req.user.id;

        const shares = await LectureShare.find({ user: userId })
        .populate("lecture") // lấy dữ liệu bài giảng
        .sort({ createdAt: -1 });

        const sharedLectures = await Promise.all(
        shares.map(async (s) => {
            const signedUrl = getSignedUrlCloudinary(s.lecture.publicId);
            const creator = await getUserInfo(s.lecture.createdBy);

            return {
            _id: s.lecture._id,
            title: s.lecture.title,
            description: s.lecture.description,
            videoUrl: signedUrl,
            mimeType: s.lecture.mimeType,
            fileSize: s.lecture.fileSize,
            sharedAt: s.createdAt,
            createdBy: creator, // trả về object { name, email, _id }
            };
        })
        );

        res.json({ lectures: sharedLectures });
    } catch (err) {
        console.error("[LectureShare] Get shared lectures error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
}

// Hủy share
async function deleteShare(req, res) {
  try {
    const { id } = req.params; // id của LectureShare

    const share = await LectureShare.findById(id).populate("lecture");
    if (!share) return res.status(404).json({ message: "Share not found" });

    // Chỉ owner mới được xóa share
    if (share.lecture.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to delete this share" });
    }

    await share.deleteOne();
    res.json({ message: "Share deleted successfully" });
  } catch (err) {
    console.error("[LectureShare] Delete share error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// --- Mới: Lấy danh sách user được share cho 1 lecture ---
async function getSharesByLecture(req, res) {
  try {
    const { lectureId } = req.params;
    const userId = req.user.id;

    if (!lectureId) return res.status(400).json({ message: "lectureId is required" });

    const lecture = await Lecture.findById(lectureId);
    if (!lecture) return res.status(404).json({ message: "Lecture not found" });

    // Chỉ owner mới xem được danh sách share
    if (lecture.createdBy.toString() !== userId) {
      return res.status(403).json({ message: "Not authorized to view shares for this lecture" });
    }

    const shares = await LectureShare.find({ lecture: lectureId }).sort({ createdAt: -1 });

    // Lấy thông tin user cho mỗi share
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

    res.json({ lectureId, sharedUsers: users });
  } catch (err) {
    console.error("[LectureShare] Get shares by lecture error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}


module.exports = { createShare, getSharedLectures, deleteShare, getSharesByLecture };
