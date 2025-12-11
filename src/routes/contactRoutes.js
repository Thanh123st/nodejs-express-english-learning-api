const express = require("express");
const { createContact } = require("../controllers/contactController");

const router = express.Router();

// Chỉ duy nhất POST
router.post("/", createContact);

module.exports = router;
