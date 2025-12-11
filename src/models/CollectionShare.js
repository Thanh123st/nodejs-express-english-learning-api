const mongoose = require("mongoose");

const collectionShareSchema = new mongoose.Schema(
  {
    collection: { type: mongoose.Schema.Types.ObjectId, ref: "Collection", required: true, index: true },
    owner:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sharedWith: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status:     { type: String, enum: ["pending", "accepted", "revoked"], default: "accepted" }
  },
  { timestamps: true }
);

collectionShareSchema.index({ collection: 1, sharedWith: 1 }, { unique: true });

module.exports = mongoose.model("CollectionShare", collectionShareSchema);
