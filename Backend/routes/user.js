const express = require("express");
const User = require("../models/User");

const router = express.Router();

router.post("/", async (req, res) => {
  const { uid, name } = req.body;
  if (!uid || !name) return res.status(400).json({ message: "UID and name required" });

  try {
    const existingUser = await User.findOne({ uid });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const newUser = new User({ uid, name });
    await newUser.save();
    res.status(201).json({ message: "User saved in MongoDB" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
