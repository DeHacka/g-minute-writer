# Here's what each one does so you're not just copy-pasting blindly:

fastapi — the web framework, lets us create API endpoints
uvicorn — the server that runs FastAPI
groq — the official Groq Python SDK to call their AI models
python-dotenv — reads your API key from a .env file so you never hardcode secrets
python-multipart — allows FastAPI to receive audio file uploads



# Transcriber Documentation
Step 1 — Create your .env file
Inside your ai-service folder, create a file called .env and put this in it:
GROQ_API_KEY=your_actual_key_here
Replace your_actual_key_here with the Groq API key you got from console.groq.com.
This file should never be pushed to GitHub. It holds secrets. We'll add a .gitignore later.

Step 2 — Create transcriber.py
Create this file inside ai-service and I'll explain every line after:Viewed a file, created a fileViewed a file, created a fileCheck skills availableCreating transcriber.py for the ai-servicetranscriber.pyDoneNow let me explain every decision in that file before we move on, because understanding this makes you a better developer:
load_dotenv() — this reads your .env file and loads GROQ_API_KEY into the environment. Without this, os.getenv("GROQ_API_KEY") would return None and nothing would work.
client = Groq(...) — we create this once at the top of the file, not inside the function. If we created it inside the function, it would be recreated on every single audio chunk. That's wasteful. One client, reused everywhere.
whisper-large-v3 — even though we're on Option A (chunked), we're still using Groq's servers so we can afford the large model. It's free and fast on their end. This is much better at accents than smaller models.
The prompt parameter — this is a hidden gem most tutorials never mention. Whisper accepts a prompt that biases its transcription. By telling it "Ghanaian accent" and "formal meeting," it adjusts its predictions accordingly. This genuinely improves accuracy.



# Step 3 — Create summarizer.py:
temperature=0.3 — temperature controls how "creative" the AI is. High temperature (0.9+) means varied, creative responses. Low temperature (0.3) means focused, consistent, factual output. For meeting minutes you always want low temperature. You don't want the AI improvising.
The prompt format — notice how we gave Llama 3 a very specific template to fill in. Vague prompts give vague results. Specific prompts with exact sections give you predictable, structured output every time. This is called prompt engineering and it's a real skill.



# Step 4 — Create main.py
This is the FastAPI server that ties everything together:Created 2 files, read a fileCreated 2 files, read a fileCreating main.py FastAPI servermain.pyCreating requirements.txtrequirements.txtPresented 4 filesDoneYour Python service is complete. Here's what to do now:
Your folder should look like this:
ai-service/
├── venv/
├── main.py
├── transcriber.py
├── summarizer.py
├── requirements.txt
└── .env          ← create this manually with your Groq key
To start the server, run:
bashcd ai-service
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

You should see:
```
INFO: Uvicorn running on http://0.0.0.0:8000
To test it's working, open your browser and go to http://localhost:8000 — you should see {"status": "Minute Writer AI Service is running"}. Also visit http://localhost:8000/docs — FastAPI automatically generates a beautiful interactive API docs page where you can test your endpoints directly in the browser without writing any code.

Once your server is running, come back and tell me. We'll move to the Node.js backend next — it'll be shorter than this because the heavy lifting is done here in Python. Then we build the React frontend where everything comes together visually.



# npm install express cors axios multer dotenv express-fileupload form-data pdfkit
```

What each does:
- `express` — the web framework, same role as FastAPI but for Node
- `cors` — allows the React frontend to talk to this server
- `axios` — makes HTTP requests from Node to the Python service
- `multer` — handles file uploads (the audio chunks)
- `dotenv` — reads `.env` file
- `express-fileupload` — helps forward files between services
- `form-data` — lets us build multipart form requests to send audio to Python
- `pdfkit` — generates the PDF from the minutes text

---

Now create these files. First your `.env`:
```
PYTHON_SERVICE_URL=http://localhost:8000
PORT=5000

# Build APK with expo
# Install EAS CLI
npm install -g eas-cli

# Login to your Expo account (create one free at expo.dev if you don't have one)
eas login

# Configure your project
cd mobile
eas build:configure

# Build APK for Android
eas build -p android --profile preview