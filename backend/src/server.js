const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const { transcribeChunk, generateMinutes } = require("./pythonBridge");
const { generatePDF } = require("./pdfGenerator");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded from bodies
app.use(express.urlencoded({ extended: true }));

// Multer handles file uploads - we store files in memory (not on disk)
// MemoryStorage means the uploaded file lands in req.file buffer as a Buffer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max per chunk - more than enough for 5 seconds of audio
    },
});

// Routes

// Health check
app.get("/", (req, res) => {
    res.json({ status: "Minutes Writer Backend is running" });
});

/**
 * POST /transcribe
 * Receives an audio chunk from the React frontend.
 * Forwards it to the Python service and returns the transcript text.
 *
 * The frontend sends this every ~5 seconds while recording.
 */
app.post("/transcribe", upload.single("audio"), async (req, res) => {
    try {
        // upload.single("audio") puts the uploaded file into req.file
        // req.file.buffer contains the raw audio bytes
        if (!req.file) {
            return res.status(400).json({ success: false, error: "No audio file received" });
        }

        console.log(`Received audio chunk: ${req.file.size} bytes`);

        // Forward to Python and get back text
        const text = await transcribeChunk(req.file.buffer, req.file.mimetype);

        console.log(`Transcribed: ${text}`);

        res.json({ success: true, text });
    } catch (error) {
        console.error("Transcription error: ", error.message);
        res.status(500).json({
            success: false,
            error: "Transcription failed. Check that Python service is running.",
        });
    }
});

/**
 * POST /generate-minutes
 * Receives the full transcript text.
 * Gets AI-generated minutes from Python, then generates and returns a PDF.
 */
app.post("/generate-minutes", async (req, res) => {
  try {
    const { transcript, meetingTitle } = req.body;

    if (!transcript || transcript.trim() === "") {
      return res.status(400).json({ success: false, error: "Transcript is required" });
    }

    console.log("Generating minutes for transcript length:", transcript.length, "chars");

    // Step 1: Get the AI-written minutes from Python
    const minutesText = await generateMinutes(transcript, meetingTitle || "Meeting");

    // Guard: if Python returned null or empty, stop here with a clear error
    // instead of crashing inside generatePDF with "Cannot read properties of null"
    if (!minutesText || minutesText.trim() === "") {
        return res.status(500).json({
            success: false,
            error: "AI returned empty minutes. Please try with a longer recording.",
        });
    }

    // Step 2: Convert the minutes text into a PDF buffer
    const pdfBuffer = await generatePDF(minutesText, meetingTitle || "Meeting");
    console.log("PDF buffer size:", pdfBuffer.length);

    // Step 3: Send the PDF directly as a downloadable file
    // These headers tell the browser: "this is a PDF file, download it as minutes.pdf"
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="minutes.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error("Minutes generation error:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to generate minutes. Please try again.",
    });
  }
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n Minute Writer Backend is running on http://localhost:${PORT}`);
    console.log(`   Make sure Python service is running on http://localhost:8000\n`);
});