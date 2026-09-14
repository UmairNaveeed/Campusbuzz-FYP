const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.join(
      __dirname,
      "../firebaseAdmin/serviceAccountKey.json"
    );
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf8")
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

/**
 * Firebase Authentication Middleware
 * Verifies the Firebase ID token and attaches user UID to req.user.uid
 */
const authenticateFirebase = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: No token provided",
      });
    }

    const token = authHeader.split("Bearer ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid token format",
      });
    }

    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Attach user UID to request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };

    next();
  } catch (error) {
    console.error("Firebase authentication error:", error);
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or expired token",
    });
  }
};

module.exports = authenticateFirebase;
