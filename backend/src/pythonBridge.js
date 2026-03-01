const axios = require("axios");
const FormData = require("form-data");
require("dotenv").config();

const PYTHON_URL = process.env.PYTHON_URL || "http://localhost:8000";

/**
 * Sends audio buffer to Python transcription service.
 * Audio must be sent as multipart/form-data — Groq requires a real file upload.
 */
async function transcribeChunk(audioBuffer, mimetype = "audio/mp4") {
  const form = new FormData();
  form.append("audio", audioBuffer, {
    filename: "chunk.m4a",
    contentType: mimetype,
  });

  const response = await axios.post(`${PYTHON_URL}/transcribe`, form, {
    headers: { ...form.getHeaders() },
    timeout: 30000,
  });

  return response.data.text;
}

/**
 * Sends transcript to Python to generate meeting minutes.
 *
 * WHY JSON INSTEAD OF FORM DATA:
 *   Form data encoding breaks when the transcript contains special characters
 *   like quotes, ellipses, or newlines — the server receives a truncated string.
 *   JSON handles all characters safely and preserves the full transcript.
 */
async function generateMinutes(transcript, meetingTitle = "Meeting") {
  const response = await axios.post(
    `${PYTHON_URL}/generate-minutes`,
    // Send as JSON — Python will read from request.body instead of Form(...)
    { transcript, meeting_title: meetingTitle },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 60000,
    }
  );

  return response.data.minutes;
}

module.exports = { transcribeChunk, generateMinutes };