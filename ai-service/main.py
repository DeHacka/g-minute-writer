from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from transcriber import transcribe_audio_chunk
from summarizer import generate_minutes
import uvicorn
import traceback

app = FastAPI(title="Minute Writer AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REQUEST MODEL ──────────────────────────────────────────────────────
# Using a Pydantic model means FastAPI reads the body as JSON.
# This is more reliable than Form(...) for long text with special characters.
class MinutesRequest(BaseModel):
    transcript: str
    meeting_title: str = "Meeting"


@app.get("/")
@app.head("/")
def health_check():
    return {"status": "Minute Writer AI Service is running"}


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    try:
        audio_bytes = await audio.read()

        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file received")

        print(f"Received audio: {len(audio_bytes)} bytes, filename: {audio.filename}, content_type: {audio.content_type}")

        text = transcribe_audio_chunk(audio_bytes, filename=audio.filename or "chunk.m4a")

        print(f"Transcribed: \"{text}\"")

        return JSONResponse(content={"success": True, "text": text})

    except HTTPException:
        raise
    except Exception as e:
        print(f"Transcription error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@app.post("/generate-minutes")
async def generate(request: MinutesRequest):
    """
    Receives transcript as JSON body.
    JSON preserves the full transcript including special characters,
    unlike form data which can truncate on special characters.
    """
    try:
        transcript = request.transcript
        meeting_title = request.meeting_title

        print(f"Generating minutes, transcript length: {len(transcript)} chars")
        print(f"Transcript preview: {transcript[:100]}...")

        if not transcript.strip() or len(transcript.strip()) < 20:
            raise HTTPException(
                status_code=400,
                detail="Transcript is too short. Please record more of the meeting."
            )

        minutes = generate_minutes(transcript, meeting_title)

        print(f"Minutes generated, length: {len(minutes) if minutes else 0} chars")

        return JSONResponse(content={"success": True, "minutes": minutes})

    except HTTPException:
        raise
    except Exception as e:
        print(f"Minutes generation error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Minutes generation failed: {str(e)}")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)