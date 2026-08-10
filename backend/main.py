import os
import io
import traceback
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.concurrency import run_in_threadpool

from backend.trainer import train_model, DATA_DIR, MODEL_PATH
from backend.classifier import classifier_instance
from scripts.generate_sample_data import generate_all_samples
from scripts.map_grades import match_birds

app = FastAPI(
    title="Bioacoustic Bird Vocalization Classifier",
    description="API for audio similarity scoring and species classification using bioacoustic features.",
    version="1.0.0"
)

# Enable CORS middleware for front-end integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

@app.on_event("startup")
async def startup_event():
    """Auto-train model on user dataset if exists, or auto-generate synthetic samples."""
    if not classifier_instance.is_trained or not os.path.exists(MODEL_PATH):
        print("[*] Initializing model training on dataset...")
        try:
            if not os.path.exists(DATA_DIR) or not os.listdir(DATA_DIR):
                generate_all_samples(DATA_DIR)
            await run_in_threadpool(train_model, DATA_DIR, MODEL_PATH)
            await run_in_threadpool(match_birds)
            classifier_instance.load_model()
            print("[*] Model training complete.")
        except Exception as e:
            print(f"[!] Startup auto-training warning: {e}")

@app.get("/")
async def root(request: Request):
    """
    Health check, training state, and list of supported species & categories.
    Returns HTML UI if requested by browser, or JSON status if requested as API.
    """
    accept_header = request.headers.get("accept", "")
    if "text/html" in accept_header:
        index_path = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
    
    status = classifier_instance.get_status()
    return {
        "status": "healthy",
        "service": "Bioacoustic Bird Vocalization Classifier API",
        "is_trained": status["is_trained"],
        "categories": status.get("categories", []),
        "supported_species": status["species_list"],
        "species_count": status["species_count"],
        "sample_count": status["sample_count"],
        "samples_per_species": status["samples_per_species"],
        "trained_at": status["trained_at"]
    }

@app.get("/api/status")
async def get_status():
    """Dedicated status endpoint for training state and supported species."""
    status = classifier_instance.get_status()
    return {
        "status": "healthy",
        "is_trained": status["is_trained"],
        "categories": status.get("categories", []),
        "supported_species": status["species_list"],
        "species_count": status["species_count"],
        "sample_count": status["sample_count"],
        "samples_per_species": status["samples_per_species"],
        "trained_at": status["trained_at"]
    }

@app.post("/train")
async def trigger_training():
    """Trigger dataset scan and rebuild species feature centroids asynchronously."""
    try:
        if not os.path.exists(DATA_DIR) or not os.listdir(DATA_DIR):
            generate_all_samples(DATA_DIR)

        payload = await run_in_threadpool(train_model, DATA_DIR, MODEL_PATH)
        await run_in_threadpool(match_birds)
        classifier_instance.load_model()
        return {
            "success": True,
            "message": "Model training completed successfully.",
            "trained_at": payload["trained_at"],
            "sample_count": payload["sample_count"],
            "species_count": len(payload["species_list"]),
            "categories": payload.get("categories", []),
            "supported_species": payload["species_list"]
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/generate-samples")
async def generate_samples():
    """Endpoint to synthesize sample audio files for demo species."""
    try:
        generate_all_samples(DATA_DIR)
        return {"success": True, "message": "Synthetic sample audio dataset created."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate samples: {str(e)}")

@app.post("/classify")
async def classify_audio(file: UploadFile = File(...)):
    """
    Accept multipart file upload (WAV, MP3, OGG, WebM, FLAC, etc.),
    process in-memory stream via BytesIO, extract bioacoustic features,
    and return species + category similarity rankings.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No audio file uploaded.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes).")

    try:
        audio_stream = io.BytesIO(content)
        result = await run_in_threadpool(classifier_instance.classify_audio_multi, audio_stream)
        return result
    except RuntimeError as re:
        raise HTTPException(status_code=400, detail=str(re))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Failed to process audio file: {str(e)}")

if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
