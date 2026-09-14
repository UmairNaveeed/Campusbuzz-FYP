// // backend/routes/auth.js
// import express from "express";
// import User from "../models/User.js";

// const router = express.Router();

// // POST /api/auth/signup
// router.post("/signup", async (req, res) => {
//   try {
//     const { firebaseUid, name, role } = req.body;

//     if (!firebaseUid || !name || !role) {
//       return res.status(400).json({ error: "firebaseUid, name, and role required" });
//     }

//     // Check if user already exists
//     const existingUser = await User.findOne({ firebaseUid });
//     if (existingUser) {
//       return res.status(400).json({ error: "User already exists in database" });
//     }

//     const newUser = new User({ firebaseUid, name, role });
//     await newUser.save();

//     res.status(201).json({ message: "User saved successfully" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// export default router;
