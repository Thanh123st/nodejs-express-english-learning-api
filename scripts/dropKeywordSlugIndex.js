require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: true });
    const db = mongoose.connection.db;
    const col = db.collection("keywords");

    const indexes = await col.indexes();
    const slugIdx = indexes.find(i => i.name === "slug_1" || (i.key && i.key.slug === 1));
    if (slugIdx) {
      console.log("Dropping index:", slugIdx.name);
      await col.dropIndex(slugIdx.name);
      console.log("✅ Dropped slug index");
    } else {
      console.log("ℹ️ No slug index found; nothing to drop.");
    }
  } catch (e) {
    console.error("Drop index error:", e);
  } finally {
    await mongoose.disconnect();
  }
})();
