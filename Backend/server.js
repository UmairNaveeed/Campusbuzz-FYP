import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { connectDB } from "./database/connect.js";
import {
  User,
  Post,
  Message,
  Conversation,
  ConversationParticipant,
  ConversationDeletedBy,
  MessageReadBy,
  AlumniSignup,
} from "./database/index.js";
import multer from "multer";
import { syncMongoUsersWithFirebase } from "./utils/syncFirebaseUsers.js";
import { validateUsername } from "./utils/validateUsername.js";
import { parseRollNumber } from "./utils/rollNumberParser.js";
import verifyFirebaseToken from "./middleware/verifyFirebaseToken.js";
import { requireAdmin } from "./middleware/requireAdmin.js";
import {
  listAdminUsers,
  listSuspendedAdminUsers,
  getAdminUserDetail,
  suspendAdminUser,
  unsuspendAdminUser,
  deleteAdminUser,
} from "./controllers/adminUserController.js";
import {
  getAdminProfile,
  changeAdminPassword,
} from "./controllers/adminProfileController.js";
import { getAdminDashboardStats } from "./controllers/adminDashboardController.js";
import { getAdminReport } from "./controllers/adminReportsController.js";
import { verifyAdminPassword, ensureAdminCredentials } from "./utils/adminPassword.js";
import { ADMIN_EMAILS } from "./utils/adminConfig.js";
import {
  listReportedPosts,
  getReportedPostDetail,
  dismissPostReports,
  adminDeleteReportedPost,
} from "./controllers/adminPostModerationController.js";
import { getAdminSentimentOverview } from "./controllers/adminSentimentController.js";
import {
  findUserForLogin,
  getLoginSuspensionStatus,
  SUSPENDED_LOGIN_MESSAGE,
} from "./utils/checkAccountSuspended.js";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.env') });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 5000;

// ================= MIDDLEWARE =================
app.use(cors());
// JSON payload limit for base64 profile/cover updates (compress client-side; cap raised for large originals)
app.use(express.json({ limit: '80mb' }));
app.use(express.urlencoded({ extended: true, limit: '80mb' }));

// ================= FIX __dirname =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= FIREBASE ADMIN =================
const serviceAccountPath = path.join(
  __dirname,
  "firebaseAdmin",
  "serviceAccountKey.json"
);

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, "utf-8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ================= MONGODB =================
// Optional: set MONGODB_URI in .env (default: mongodb://localhost:27017/campusbuzz)

connectDB()
  .then(async () => {
    try {
      await ensureAdminCredentials();
    } catch (err) {
      console.warn("[admin] Could not initialize admin credentials:", err.message);
    }

    let syncInProgress = false;
    const syncFirebaseUsers = async () => {
      if (syncInProgress) {
        console.warn("[syncFirebase] Skipping — previous sync still running");
        return { deleted: 0, checked: 0, skipped: true };
      }
      syncInProgress = true;
      try {
        console.log(`[syncFirebase] 🔄 Starting sync at ${new Date().toISOString()}`);
        const { deleted, checked } = await syncMongoUsersWithFirebase(admin.auth());
        if (checked > 0) {
          if (deleted > 0) {
            console.log(`[syncFirebase] ✅ Checked ${checked} users, deleted ${deleted} missing in Firebase.`);
          } else {
            console.log(`[syncFirebase] ✓ Checked ${checked} users, all exist in Firebase.`);
          }
        } else {
          console.log(`[syncFirebase] ⚠️  No users to check.`);
        }
        return { deleted, checked };
      } catch (err) {
        console.error("[syncFirebase] ❌ Sync failed:", err.message);
        return { deleted: 0, checked: 0, error: err.message };
      } finally {
        syncInProgress = false;
      }
    };

    // Store sync function for manual trigger endpoint
    app.get('/api/admin/sync-firebase-users', async (req, res) => {
      try {
        console.log('[syncFirebase] 🔧 Manual sync triggered via API');
        const result = await syncFirebaseUsers();
        res.json({ 
          success: true, 
          message: `Sync completed. Checked ${result.checked} users, deleted ${result.deleted} missing in Firebase.`,
          ...result 
        });
      } catch (error) {
        console.error('[syncFirebase] ❌ Manual sync failed:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // Initial sync shortly after startup
    setTimeout(syncFirebaseUsers, 2000);

    // Periodic sync so Firebase-deleted accounts are removed from MongoDB too.
    // Default 5 minutes — listing all Firebase users every 10s was heavy and could overlap/stack.
    const intervalMs = parseInt(process.env.FIREBASE_SYNC_INTERVAL_MS || "300000", 10);
    const safeInterval =
      Number.isFinite(intervalMs) && intervalMs >= 60000 ? intervalMs : 300000;
    console.log(
      `[syncFirebase] ⏰ Sync interval set to ${safeInterval}ms (${Math.round(safeInterval / 60000)} min)`
    );
    setInterval(syncFirebaseUsers, safeInterval);

    // Start HTTP server only after MongoDB is connected
    httpServer.listen(PORT, () => {
      console.log(`🔥 Backend running on http://localhost:${PORT}`);
      console.log(`📋 Profile routes registered at /api/profile`);
      console.log(`💬 Messaging routes registered at /api/messaging`);
      console.log(`🧑‍🤝‍🧑 Discussion routes registered at /api/discussion`);
      console.log(`🔌 Socket.io server ready`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

// ================= ROUTES =================
import profileRoutes from "./routes/profileRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import messagingRoutes from "./routes/messagingRoutes.js";
import discussionRoutes from "./routes/discussionRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import listRoutes from "./routes/listRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

// ================= PROFILE ROUTES =================
try {
  app.use("/api/profile", profileRoutes);
  console.log("✅ Profile routes registered at /api/profile");
} catch (error) {
  console.error("❌ Error registering profile routes:", error);
}

// ================= POST ROUTES =================
try {
  app.use("/api/posts", postRoutes);
  console.log("✅ Post routes registered at /api/posts");
} catch (error) {
  console.error("❌ Error registering post routes:", error);
}

// ================= MESSAGING ROUTES =================
try {
  app.use("/api/messaging", messagingRoutes);
  console.log("✅ Messaging routes registered at /api/messaging");
} catch (error) {
  console.error("❌ Error registering messaging routes:", error);
}

// ================= DISCUSSION ROUTES =================
try {
  app.use("/api/discussion", discussionRoutes);
  console.log("✅ Discussion routes registered at /api/discussion");
} catch (error) {
  console.error("❌ Error registering discussion routes:", error);
}

// ================= NOTIFICATION ROUTES =================
try {
  app.use("/api/notifications", notificationRoutes);
  console.log("✅ Notification routes registered at /api/notifications");
} catch (error) {
  console.error("❌ Error registering notification routes:", error);
}

// ================= CUSTOM LIST ROUTES =================
try {
  app.use("/api/lists", listRoutes);
  console.log("✅ List routes registered at /api/lists");
} catch (error) {
  console.error("❌ Error registering list routes:", error);
}

// ================= ADMIN ROUTES =================
try {
  app.use("/api/admin", adminRoutes);
  console.log("✅ Admin routes registered at /api/admin");
} catch (error) {
  console.error("❌ Error registering admin routes:", error);
}

// ================= USER ROUTES =================

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const t = email.trim();
  return t.length > 0 && t.includes('@') && t.includes('.');
}

// Create / update user (signup + profile sync)
app.post("/api/users", async (req, res) => {
  try {
    const { firebaseId, name, email, username, currentStatus } = req.body || {};
    console.log("📥 POST /api/users - Request body:", { firebaseId: !!firebaseId, name: !!name, email: !!email, username: username ? 'provided' : 'not provided', currentStatus: currentStatus ?? 'not provided' });

    if (!firebaseId || typeof firebaseId !== 'string') {
      return res.status(400).json({ error: "Firebase ID is required" });
    }
    const trimmedFirebaseId = firebaseId.trim();
    if (trimmedFirebaseId.length < 10) {
      return res.status(400).json({ error: "Invalid Firebase ID" });
    }

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: "Name is required" });
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 1) return res.status(400).json({ error: "Name cannot be empty" });
    if (trimmedName.length > 255) return res.status(400).json({ error: "Name is too long" });

    if (username !== undefined && username !== null && String(username).trim() !== '') {
      const uCheck = validateUsername(username);
      if (!uCheck.valid) return res.status(400).json({ error: uCheck.error });
    }

    let userEmail;
    try {
      const firebaseUser = await admin.auth().getUser(trimmedFirebaseId);
      if (!firebaseUser.emailVerified) {
        return res.status(400).json({ error: "Email must be verified before creating user. Please check your inbox for the verification link." });
      }
      userEmail = (email && typeof email === 'string' ? email.trim() : null) || firebaseUser.email || null;
      if (!userEmail) {
        return res.status(400).json({ error: "Email is required. Please use an account with a verified email." });
      }
    } catch (firebaseErr) {
      console.error("Firebase user lookup error:", firebaseErr.code, firebaseErr.message);
      if (firebaseErr.code === 'auth/user-not-found') {
        return res.status(400).json({ error: "Invalid user. Please sign in again." });
      }
      return res.status(400).json({ error: "Could not verify user. Please try again." });
    }

    const normalizedEmail = userEmail.trim().toLowerCase();
    if (!validateEmail(normalizedEmail)) {
      return res.status(400).json({ error: "A valid email address is required" });
    }
    if (!normalizedEmail.endsWith('@gift.edu.pk')) {
      return res.status(400).json({ error: "Only @gift.edu.pk (university) email addresses can create an account." });
    }

    const rollData = parseRollNumber(normalizedEmail);
    const rollLen = String(rollData?.rollNumber || '').length;
    if (!rollData || (rollLen !== 9 && rollLen !== 11)) {
      return res.status(400).json({ error: "Invalid university email. Use your 9 or 11-digit roll number @gift.edu.pk (e.g. 251370001@gift.edu.pk or 25101960001@gift.edu.pk)." });
    }
    const yearCode = parseInt(rollData.rollNumber.substring(0, 2), 10);
    const currentYearCode = new Date().getFullYear() - 2000;
    if (yearCode < 18 || yearCode > currentYearCode) {
      return res.status(400).json({ error: `Invalid roll number. Admission year must be between 2018 and 20${currentYearCode} (first two digits 18 to ${currentYearCode}). Use your official 9 or 11-digit roll number @gift.edu.pk.` });
    }
    if (rollData.department === "General Studies") {
      return res.status(400).json({ error: "Invalid roll number. Your roll number does not match any registered program at GIFT. Use your official 9 or 11-digit roll number @gift.edu.pk." });
    }
    const currentYear = new Date().getFullYear();
    const derivedStatus = currentYear > rollData.endYear ? 'alumni' : 'student';
    const finalUsername = (username !== undefined && username !== null && String(username).trim() !== '') ? validateUsername(username).value : null;

    try {
      let user = await User.findOne({ firebaseId: trimmedFirebaseId });

      if (user) {
        user.name = trimmedName;
        user.email = normalizedEmail;
        if (finalUsername !== null) {
          const existingUsername = await User.findOne({ username: finalUsername, _id: { $ne: user._id } });
          if (existingUsername) return res.status(400).json({ error: "Username already taken" });
          user.username = finalUsername;
        }
        if (rollData) {
          user.rollNumber = rollData.rollNumber;
          user.startYear = rollData.startYear;
          user.startSemester = rollData.startSemester;
          user.department = rollData.department;
          user.endYear = rollData.endYear;
          user.program = rollData.program;
        }
        user.currentStatus = derivedStatus;
        await user.save();
        const u = user.toObject ? user.toObject() : user;
        if (u && !u.id) u.id = u._id;
        return res.json({ success: true, message: "User updated", user: u });
      }

      const existingByEmail = await User.findOne({ email: normalizedEmail });
      if (existingByEmail) {
        if (finalUsername) {
          const taken = await User.findOne({ username: finalUsername, _id: { $ne: existingByEmail._id } });
          if (taken) return res.status(400).json({ error: "Username already taken" });
        }
        existingByEmail.firebaseId = trimmedFirebaseId;
        existingByEmail.name = trimmedName;
        existingByEmail.email = normalizedEmail;
        if (finalUsername !== null) existingByEmail.username = finalUsername;
        if (rollData) Object.assign(existingByEmail, rollData);
        existingByEmail.currentStatus = derivedStatus;
        await existingByEmail.save();
        const u = existingByEmail.toObject ? existingByEmail.toObject() : existingByEmail;
        if (u && !u.id) u.id = u._id;
        return res.status(200).json({ success: true, message: "User re-linked", user: u });
      }

      if (finalUsername) {
        const existingByUsername = await User.findOne({ username: finalUsername });
        if (existingByUsername) {
          if (String(existingByUsername.firebaseId) === String(trimmedFirebaseId)) {
            return res.status(400).json({ error: "Username already taken" });
          }
          existingByUsername.firebaseId = trimmedFirebaseId;
          existingByUsername.name = trimmedName;
          existingByUsername.email = normalizedEmail;
          if (rollData) Object.assign(existingByUsername, rollData);
          existingByUsername.currentStatus = derivedStatus;
          await existingByUsername.save();
          const u = existingByUsername.toObject ? existingByUsername.toObject() : existingByUsername;
          if (u && !u.id) u.id = u._id;
          return res.status(200).json({ success: true, message: "User re-linked", user: u });
        }
      }

      const newUser = await User.create({
        firebaseId: trimmedFirebaseId,
        email: normalizedEmail,
        name: trimmedName,
        username: finalUsername,
        currentStatus: derivedStatus,
        ...(rollData || {}),
      });
      const u = newUser.toObject ? newUser.toObject() : newUser;
      if (u && !u.id) u.id = u._id;
      console.log("✅ User saved to MongoDB:", { id: u.id || u._id, email: normalizedEmail, firebaseId: trimmedFirebaseId });
      res.status(201).json({ success: true, message: "User created", user: u });
    } catch (dbErr) {
      console.error("DB error in POST /api/users:", dbErr);
      throw dbErr;
    }
  } catch (err) {
    console.error("Error in POST /api/users:", err);
    if (err.name === 'MongoServerError' && err.code === 11000) {
      const key = Object.keys(err.keyPattern || {})[0] || '';
      if (key === 'username') return res.status(400).json({ error: "Username already taken" });
      if (key === 'firebaseId') return res.status(400).json({ error: "User already exists with this account" });
      return res.status(400).json({ error: "Duplicate entry" });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors || {}).map(e => e.message);
      return res.status(400).json({ error: messages.length ? messages.join('; ') : 'Validation failed' });
    }
    res.status(500).json({
      error: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

// Get user by Firebase ID (used after login / username page)
app.get("/api/users/:firebaseId", async (req, res) => {
  try {
    const firebaseId = req.params.firebaseId;
    if (!firebaseId || typeof firebaseId !== 'string' || firebaseId.trim().length < 10) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    const user = await User.findOne({ firebaseId: firebaseId.trim() });
    if (!user) {
      return res.status(200).json({ success: false, user: null, exists: false, error: "User not found" });
    }
    const u = user.toObject ? user.toObject() : user;
    if (u && !u.id) u.id = u._id;
    res.json({ success: true, user: u, exists: true });
  } catch (err) {
    console.error("GET /api/users error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ================= ADMIN LOGIN =================
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }
    const normalizedEmail = String(email).trim().toLowerCase();

    if (!ADMIN_EMAILS.includes(normalizedEmail)) {
      return res.status(403).json({
        success: false,
        error: "This email is not registered as an administrator.",
      });
    }

    const valid = await verifyAdminPassword(normalizedEmail, password);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: "Invalid password for admin account.",
      });
    }

    return res.json({
      success: true,
      admin: { email: normalizedEmail },
    });
  } catch (err) {
    console.error("admin login error:", err);
    return res.status(500).json({ success: false, error: "Login failed" });
  }
});

// Check if email is allowed to receive admin sign-in link (no auth required)
app.post("/api/admin/check-email", (req, res) => {
  const email = (req.body?.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ allowed: false, error: "Email required" });
  if (!ADMIN_EMAILS.includes(email)) {
    return res.status(403).json({ allowed: false, error: "This email is not registered as an administrator." });
  }
  return res.json({ allowed: true });
});

// Verify admin after they sign in (Firebase token required). Same rule as students: email must be verified.
app.post("/api/admin/verify-admin", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Token required" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    let email = ((decoded.adminEmail || decoded.email || decoded.uid || "") + "").trim().toLowerCase();

    if (email.startsWith("admin:")) {
      email = email.slice("admin:".length);
    }

    if (!ADMIN_EMAILS.includes(email)) {
      return res.status(403).json({ success: false, error: "This email is not an administrator." });
    }
    return res.json({ success: true, admin: { email } });
  } catch (err) {
    return res.status(401).json({ success: false, error: "Invalid or expired link." });
  }
});

app.get("/api/admin/stats", verifyFirebaseToken, requireAdmin, getAdminDashboardStats);
app.get("/api/admin/reports", verifyFirebaseToken, requireAdmin, getAdminReport);

// Admin user management (list / suspend / unsuspend / delete)
app.get("/api/admin/sentiment/overview", verifyFirebaseToken, requireAdmin, getAdminSentimentOverview);

app.get("/api/admin/posts/reported", verifyFirebaseToken, requireAdmin, listReportedPosts);
app.get("/api/admin/posts/reported/:postId", verifyFirebaseToken, requireAdmin, getReportedPostDetail);
app.patch("/api/admin/posts/reported/:postId/dismiss", verifyFirebaseToken, requireAdmin, dismissPostReports);
app.delete("/api/admin/posts/reported/:postId", verifyFirebaseToken, requireAdmin, adminDeleteReportedPost);

app.get("/api/admin/profile", verifyFirebaseToken, requireAdmin, getAdminProfile);
app.post("/api/admin/profile/change-password", verifyFirebaseToken, requireAdmin, changeAdminPassword);

app.get("/api/admin/users/suspended", verifyFirebaseToken, requireAdmin, listSuspendedAdminUsers);
app.get("/api/admin/users", verifyFirebaseToken, requireAdmin, listAdminUsers);
app.get("/api/admin/users/:userId", verifyFirebaseToken, requireAdmin, getAdminUserDetail);
app.patch("/api/admin/users/:userId/suspend", verifyFirebaseToken, requireAdmin, suspendAdminUser);
app.patch("/api/admin/users/:userId/unsuspend", verifyFirebaseToken, requireAdmin, unsuspendAdminUser);
app.delete("/api/admin/users/:userId", verifyFirebaseToken, requireAdmin, deleteAdminUser);

// ================= VALIDATE ROLL (before signup – no auth) =================
app.post("/api/auth/validate-roll", (req, res) => {
  try {
    const email = req.body?.email;
    if (!email || typeof email !== "string") {
      return res.json({ valid: false, error: "Email is required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@gift.edu.pk")) {
      return res.json({ valid: false, error: "Only @gift.edu.pk university email addresses can sign up." });
    }
    const rollData = parseRollNumber(normalizedEmail);
    const rollLen = String(rollData?.rollNumber || "").length;
    if (!rollData || (rollLen !== 9 && rollLen !== 11)) {
      return res.json({ valid: false, error: "Use your 9 or 11-digit roll number @gift.edu.pk (e.g. 251370001@gift.edu.pk or 25101960001@gift.edu.pk)" });
    }
    const yearCode = parseInt(rollData.rollNumber.substring(0, 2), 10);
    const currentYearCode = new Date().getFullYear() - 2000;
    if (yearCode < 18 || yearCode > currentYearCode) {
      return res.json({ valid: false, error: `Admission year must be 2018–20${currentYearCode} (first two digits 18–${currentYearCode}).` });
    }
    if (rollData.department === "General Studies") {
      return res.json({ valid: false, error: "Roll number does not match any registered program at GIFT." });
    }
    return res.json({ valid: true });
  } catch (err) {
    console.error("Validate roll error:", err);
    return res.json({ valid: false, error: "Invalid roll number." });
  }
});

// ================= FORGOT PASSWORD =================
app.post("/api/auth/check-email", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    await admin.auth().getUserByEmail(email);
    return res.json({ exists: true });
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      return res.json({ exists: false });
    }
    console.error("Check email error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ================= USERNAME SUGGESTIONS =================
app.post("/api/auth/username-suggestions", async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return res.status(400).json({ error: "Name is required" });
    }

    const baseName = (name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') || 'user').slice(0, 20);
    const suggestions = [
      baseName,
      baseName + Math.floor(Math.random() * 1000),
      baseName + Math.floor(Math.random() * 10000),
      baseName + '_' + Math.floor(Math.random() * 100),
    ].filter(s => s.length >= 3);

    const availableSuggestions = [];
    for (const sugg of suggestions) {
      const existing = await User.findOne({ username: sugg });
      if (!existing && sugg.length >= 3) {
        availableSuggestions.push(sugg);
      }
      if (availableSuggestions.length >= 3) break;
    }
    if (availableSuggestions.length === 0) {
      availableSuggestions.push(baseName + Math.floor(Math.random() * 99999));
    }

    res.json({ success: true, suggestions: availableSuggestions });
  } catch (err) {
    console.error("Username suggestions error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================= USERNAME LOGIN LOOKUP =================
app.post("/api/auth/resolve-username", async (req, res) => {
  try {
    const rawUsername = String(req.body?.username || '').trim();
    if (!rawUsername) {
      return res.status(400).json({ error: "Username is required" });
    }

    const user = await findUserForLogin({ username: rawUsername });

    if (!user) {
      return res.status(404).json({ error: "Username not found" });
    }
    if (!user.email) {
      return res.status(400).json({ error: "This account has no email linked" });
    }

    const { suspended } = await getLoginSuspensionStatus({ username: rawUsername });
    if (suspended) {
      return res.status(403).json({
        error: SUSPENDED_LOGIN_MESSAGE,
        suspended: true,
      });
    }

    return res.json({
      success: true,
      email: user.email,
      username: user.username,
    });
  } catch (err) {
    console.error("Resolve username error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Check if account exists and is suspended (before / after Firebase login attempt)
app.post("/api/auth/account-status", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const username = String(req.body?.username || "").trim().replace(/^@+/, "");
    if (!email && !username) {
      return res.status(400).json({ error: "Email or username is required" });
    }
    const { exists, suspended } = await getLoginSuspensionStatus({ email, username });
    if (!exists) {
      return res.json({ exists: false, suspended: false });
    }
    if (suspended) {
      return res.status(403).json({
        exists: true,
        suspended: true,
        error: SUSPENDED_LOGIN_MESSAGE,
      });
    }
    return res.json({ exists: true, suspended: false });
  } catch (err) {
    console.error("Account status error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ================= ALUMNI SIGNUP =================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max for transcripts
  fileFilter: (req, file, cb) => {
    const allowed = /\.(pdf|doc|docx|jpg|jpeg|png|gif)$/i.test(file.originalname);
    if (allowed) cb(null, true);
    else cb(new Error("Only PDF, DOC, DOCX, or image files allowed"));
  },
});

app.post("/api/auth/signup/alumni", upload.single("transcript"), async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    const alumniEmail = (req.body?.alumniEmail || req.body?.email || "").trim().toLowerCase();

    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!alumniEmail || !alumniEmail.includes("@")) return res.status(400).json({ error: "Valid email is required" });
    if (!req.file) return res.status(400).json({ error: "Transcript is required" });

    const existingUser = await User.findOne({ email: alumniEmail }).select('_id accountType').lean();
    if (existingUser) {
      return res.status(400).json({ error: "This email is already registered and cannot be used for a new alumni signup." });
    }

    const existingSignup = await AlumniSignup.findOne({
      alumniEmail,
      status: { $in: ['pending', 'approved'] },
    }).select('_id status').lean();
    if (existingSignup) {
      return res.status(400).json({ error: "An alumni signup request for this email already exists." });
    }

    const signup = await AlumniSignup.create({
      name,
      alumniEmail,
      transcriptOriginalName: req.file.originalname,
      transcriptData: req.file.buffer,
      transcriptMime: req.file.mimetype,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Alumni signup submitted. Pending approval.",
      id: signup._id,
    });
  } catch (err) {
    console.error("Alumni signup error:", err);
    if (err.message?.includes("file")) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Alumni signup failed. Please try again." });
  }
});

// Helper: find conversation between two user ids (non-group)
async function findConversationBetween(userId1, userId2) {
  const ids = [userId1, userId2].filter(Boolean);
  if (ids.length !== 2) return null;
  const participants = await ConversationParticipant.find({ userId: { $in: ids } });
  const byConv = new Map();
  for (const p of participants) {
    const cid = String(p.conversationId);
    if (!byConv.has(cid)) byConv.set(cid, new Set());
    byConv.get(cid).add(String(p.userId));
  }
  for (const [cid, set] of byConv) {
    if (set.size === 2 && set.has(String(ids[0])) && set.has(String(ids[1]))) {
      return Conversation.findById(cid);
    }
  }
  return null;
}

// ================= SOCKET.IO SETUP =================
const userSockets = new Map();

import { setSocketInstance } from './utils/socketHelper.js';
setSocketInstance(io, userSockets);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error: No token provided"));
    const decodedToken = await admin.auth().verifyIdToken(token);
    socket.userId = decodedToken.uid;
    next();
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication error: Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.userId}`);
  userSockets.set(socket.userId, socket.id);
  socket.join(`user:${socket.userId}`);

  socket.on("dm:send_message", async (data) => {
    try {
      const { recipientId, content, media, link } = data;
      const sender = await User.findOne({ firebaseId: socket.userId });
      if (!sender) {
        socket.emit("error", { message: "User not found" });
        return;
      }
      const recipient = await User.findById(recipientId) || await User.findOne({ firebaseId: recipientId });
      if (!recipient) {
        socket.emit("error", { message: "Recipient not found" });
        return;
      }

      let conversation = await findConversationBetween(sender._id, recipient._id);
      if (!conversation) {
        conversation = await Conversation.create({
          status: 'accepted',
          lastMessageAt: new Date(),
          isGroup: false,
        });
        await ConversationParticipant.insertMany([
          { conversationId: conversation._id, userId: sender._id },
          { conversationId: conversation._id, userId: recipient._id },
        ]);
        console.log(`✅ Conversation created via socket - ID: ${conversation.id}`);
      }

      const message = await Message.create({
        conversationId: conversation._id,
        senderId: sender._id,
        content: content || null,
        mediaType: media?.type || null,
        mediaUrl: media?.url || null,
        linkUrl: link?.url || null,
        linkTitle: link?.title || null,
        linkDescription: link?.description || null,
        linkThumbnail: link?.thumbnail || null,
        deliveryStatus: "sent",
      });
      console.log(`✅ Message saved via socket - ID: ${message.id}`);

      const deletedRow = await ConversationDeletedBy.findOne({
        conversationId: conversation._id,
        userId: recipient._id,
      });
      if (deletedRow) {
        await ConversationDeletedBy.deleteOne({ _id: deletedRow._id });
        console.log(`✅ Conversation restored for recipient via socket - Conversation ID: ${conversation.id}`);
      }

      await Conversation.updateOne(
        { _id: conversation._id },
        { lastMessageId: message._id, lastMessageAt: new Date() }
      );

      const msgWithSender = await Message.findById(message._id).populate('senderId', 'name username profilePhoto firebaseId').lean();
      const msgPayload = msgWithSender ? { ...msgWithSender, id: msgWithSender._id, sender: msgWithSender.senderId } : msgWithSender;

      const recipientSocketId = userSockets.get(recipient.firebaseId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("dm:new_message", {
          message: msgPayload,
          conversation: conversation.id,
        });
        io.to(recipientSocketId).emit("notification", {
          type: "new_message",
          message: `New message from ${sender.name}`,
        });
      }
      socket.emit("dm:message_sent", {
        message: msgPayload,
      });
    } catch (error) {
      console.error("Error in send_message socket handler:", error);
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("dm:message_read", async (data) => {
    try {
      const { messageId } = data;
      const user = await User.findOne({ firebaseId: socket.userId });
      if (!user) return;
      const message = await Message.findById(messageId);
      if (!message) return;

      const existing = await MessageReadBy.findOne({ messageId, userId: user._id });
      if (!existing) {
        await MessageReadBy.create({ messageId, userId: user._id, readAt: new Date() });
        await Message.updateOne({ _id: message._id }, { deliveryStatus: "read" });
        const sender = await User.findById(message.senderId);
        if (sender) {
          const senderSocketId = userSockets.get(sender.firebaseId);
          if (senderSocketId) {
            io.to(senderSocketId).emit("dm:message_read_update", {
              messageId: message.id,
              readBy: user.id,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error in message_read socket handler:", error);
    }
  });

  socket.on("dm:typing", async (data) => {
    try {
      const { recipientId } = data;
      const recipient = await User.findById(recipientId) || await User.findOne({ firebaseId: recipientId });
      if (recipient) {
        const recipientSocketId = userSockets.get(recipient.firebaseId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("dm:user_typing", { conversationId: data.conversationId, userId: socket.userId });
        }
      }
    } catch (error) {
      console.error("Error in typing socket handler:", error);
    }
  });

  socket.on("dm:stop_typing", async (data) => {
    try {
      const { recipientId } = data;
      const recipient = await User.findById(recipientId) || await User.findOne({ firebaseId: recipientId });
      if (recipient) {
        const recipientSocketId = userSockets.get(recipient.firebaseId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("dm:user_stopped_typing", { conversationId: data.conversationId, userId: socket.userId });
        }
      }
    } catch (error) {
      console.error("Error in stop_typing socket handler:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.userId}`);
    userSockets.delete(socket.userId);
  });
});

// ================= ERROR HANDLING =================
// Handle unhandled promise rejections (prevents server crashes)
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  // Don't exit - log and continue
});

// Handle uncaught exceptions (prevents server crashes)
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Don't exit immediately - log first
  // In production, you might want to gracefully shutdown
});

// ================= START SERVER =================
// Server is started inside connectDB().then() so it only listens after MongoDB is connected.

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️ SIGTERM received. Shutting down gracefully...');
  httpServer.close(async () => {
    console.log('✅ HTTP server closed');
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});
