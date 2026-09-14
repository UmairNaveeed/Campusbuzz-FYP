// import express from "express";
// import cors from "cors";
// import admin from "firebase-admin";
// import fs from "fs";

// const app = express();
// app.use(cors());
// app.use(express.json());

// // Initialize Firebase Admin
// const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf-8"));
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// // ===============================
// // FORGOT PASSWORD EMAIL EXISTENCE CHECK
// // ===============================
// app.post("/check-email", async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     return res.status(400).json({ error: "Email is required." });
//   }

//   try {
//     // Check if user exists
//     await admin.auth().getUserByEmail(email);
//     return res.status(200).json({ exists: true });
//   } catch (err) {
//     if (err.code === "auth/user-not-found") {
//       return res.status(404).json({ exists: false });
//     }
//     console.error(err);
//     return res.status(500).json({ error: "Something went wrong." });
//   }
// });

// // ===============================
// const PORT = 5000;
// app.listen(PORT, () => console.log(`🔥 Backend running on http://localhost:${PORT}`));
