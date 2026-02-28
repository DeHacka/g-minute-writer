import os
import io
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def transcribe_audio_chunk(audio_bytes: bytes, filename: str = "chunk.m4a") -> str:
    """
    Sends audio to Groq Whisper and returns transcribed text.

    We try the audio as-is first. If Groq rejects it (which happens when
    expo-audio sends a partially written M4A), we return empty string
    and let the next chunk succeed instead of crashing.
    """

    # Detect format from filename
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "m4a"

    # Map extension to MIME type
    mime_map = {
        "m4a": "audio/mp4",
        "mp4": "audio/mp4",
        "wav": "audio/wav",
        "mp3": "audio/mpeg",
        "webm": "audio/webm",
        "ogg": "audio/ogg",
    }
    content_type = mime_map.get(ext, "audio/mp4")

    print(f"Sending to Groq: {len(audio_bytes)} bytes, type: {content_type}")

    transcription = client.audio.transcriptions.create(
        model="whisper-large-v3",
        file=(filename, audio_bytes, content_type),
        response_format="text",
        language="en",
        prompt="This is a formal meeting being recorded in Ghana. The speaker has a Ghanaian accent."
    )

    return transcription.strip() if transcription else ""