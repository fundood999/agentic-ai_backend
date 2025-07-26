const express = require("express");
const cors = require("cors");
const { Storage } = require("@google-cloud/storage");
const path = require("path");
const dotenv = require("dotenv");

const multer = require('multer');
const localSstorage = multer.memoryStorage();
const upload = multer({ 
  storage: localSstorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow JPEG images
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG images are allowed'), false);
    }
  }
});

dotenv.config();

const app = express();

// Middleware
app.use(cors({ credentials: true, origin: "*", preflightContinue: true })); // Enable CORS for React Native
app.use(express.json()); // Parse JSON bodies

// Initialize Google Cloud Storage (no credentials needed on Cloud Run)
console.log(process.cwd(), process.env.KEY_FILE);
const gcStorage = new Storage({
  projectId: process.env.PROJECT_ID,
  keyFilename: path.join(process.cwd(), process.env.KEY_FILE),
});

// Health check endpoint (required for Cloud Run)
app.get("/", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Generate signed URL for upload
app.post('/upload-image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Parse metadata from request body
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
    
    const bucket = gcStorage.bucket('image-upload-codecoast'); // Replace with your bucket name
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const file = bucket.file(fileName);
    
    // Create a write stream to GCS
    const stream = file.createWriteStream({
      metadata: {
        contentType: 'image/jpg',
      }
    });

    // Handle stream events
    stream.on('error', (error) => {
      console.error('Upload stream error:', error);
      res.status(500).json({ error: 'Upload failed' });
    });

    stream.on('finish', () => {
      res.json({
        message: 'Upload successful',
        fileName: fileName,
        size: req.file.size,
        metadata: metadata
      });
    });

    // Write the file buffer to the stream
    stream.end(req.file.buffer);

  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
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
