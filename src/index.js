const express = require("express");
const cors = require("cors");
const { Storage } = require("@google-cloud/storage");
const path = require('path') 
const dotenv = require('dotenv')

dotenv.config();

const app = express();

// Middleware
app.use(cors()); // Enable CORS for React Native
app.use(express.json()); // Parse JSON bodies

// Initialize Google Cloud Storage (no credentials needed on Cloud Run)
console.log(process.cwd(), process.env.KEY_FILE)
const storage = new Storage({
  projectId: process.env.PROJECT_ID,
  keyFilename: path.join(process.cwd(), process.env.KEY_FILE)
});

// Health check endpoint (required for Cloud Run)
app.get("/", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Generate signed URL for upload
app.post("/get-upload-url", async (req, res) => {
  try {
    const { fileName, contentType } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: "fileName is required" });
    }

    const bucket = storage.bucket("image-upload-codecoast"); // Replace with your bucket name
    const uniqueFileName = `${Date.now()}-${fileName}`;

    const [url] = await bucket.file(uniqueFileName).getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: contentType || "image/jpg",
    });

    res.json({
      uploadUrl: url,
      fileName: uniqueFileName,
      publicUrl: `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`,
    });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
const port = process.env.PORT || 8080; // Cloud Run provides PORT env variable
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
