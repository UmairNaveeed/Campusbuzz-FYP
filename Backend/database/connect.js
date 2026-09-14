import mongoose from "mongoose";

let connectionEventsRegistered = false;

function registerConnectionEvents() {
  if (connectionEventsRegistered) return;
  connectionEventsRegistered = true;

  mongoose.connection.on("disconnected", () => {
    console.warn("[mongodb] Disconnected — is MongoDB still running? API calls may fail until reconnected.");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("[mongodb] Reconnected");
  });
  mongoose.connection.on("error", (err) => {
    console.error("[mongodb] Connection error:", err.message);
  });
}

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/campusbuzz";
    registerConnectionEvents();
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

export { connectDB };
