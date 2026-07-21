from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from config.database import connect_to_mongo, close_mongo_connection
from services.theme_service import ThemeService
from utils.rate_limit import limiter
from api import auth, admin, themes, questions, exams, practical_sets, analytics, content_units, messages, profesor, progress, access_requests, study_calendar, notes, documents, notifications, draft_questions
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Opositores API",
    description="API for managing exam questions and tests for opositores",
    version="1.0.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    logger.info("Starting up application...")
    await connect_to_mongo()

    # Seed initial themes
    try:
        theme_service = ThemeService()
        await theme_service.seed_initial_themes()
        logger.info("Initial themes seeded successfully")
    except Exception as e:
        logger.error(f"Error seeding themes: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down application...")
    close_mongo_connection()

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "opositores-api"}

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Include routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(themes.router)
app.include_router(questions.router)
app.include_router(exams.router)
app.include_router(practical_sets.router)
app.include_router(analytics.router)
app.include_router(content_units.router)
app.include_router(messages.router)
app.include_router(profesor.router)
app.include_router(progress.router)
app.include_router(access_requests.router)
app.include_router(study_calendar.router)
app.include_router(notes.router)
app.include_router(documents.router)
app.include_router(notifications.router)
app.include_router(draft_questions.router)

# Sirve los PDFs subidos por profesores -- almacenamiento en disco local, solo válido en
# desarrollo (ver nota en services/document_submission_service.py).
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)