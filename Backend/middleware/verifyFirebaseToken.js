import admin from "../firebaseAdmin/firebaseAdmin.js";

// Firebase Admin is already initialized in firebaseAdmin.js
// Import the default export which is the admin instance

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ No authorization header or invalid format");
      return res.status(401).json({ 
        success: false,
        error: "No token provided" 
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      console.error("❌ Token is empty");
      return res.status(401).json({ 
        success: false,
        error: "Token is required" 
      });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("❌ Token verification failed:", error.message);
    console.error("❌ Error code:", error.code);
    return res.status(401).json({ 
      success: false,
      error: "Invalid or expired token",
      details: error.message 
    });
  }
};

export default verifyFirebaseToken;
