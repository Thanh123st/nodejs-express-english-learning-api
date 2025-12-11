const Contact = require("../models/Contact");
const { sendMailToCustomer, sendMailToAdmin } = require("../services/mailService");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[0-9]{8,15}$/;

const createContact = async (req, res) => {
  try {
    const { fullName, phoneNumber, email, content } = req.body;

    if (!fullName || !phoneNumber || !email) {
      return res.status(400).json({ message: "Full name, phone number and email are required" });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    if (content && content.length > 1000) {
      return res.status(400).json({ message: "Content must not exceed 1000 characters" });
    }

    const contact = new Contact({ fullName, phoneNumber, email, content });
    const savedContact = await contact.save();

    await Promise.all([
      sendMailToCustomer(savedContact),
      sendMailToAdmin(savedContact),
    ]);

    res.status(201).json(savedContact);
  } catch (err) {
    console.error("Error creating contact:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { createContact };
