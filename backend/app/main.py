from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import os
import logging

from .core.config import settings
from .core.database import engine, Base
from .api import auth, chat, chat_conversations, analysis, library, game, kanji, grammar_practice, grammar_lessons, rewards, daily, reminders, notifications, push, listening, internship
from .api import placement, learning, kanji_writing, chat_feedback, kanji_notes, minigame_learning, flashcards
from .services.kanji_dictionary_service import kanji_dictionary_service
from .services.reminder_scheduler import start_reminder_scheduler, stop_reminder_scheduler

try:
    from ml.kanji_recognizer import get_model_info
except ImportError:  # pragma: no cover - optional ML runtime
    get_model_info = None

logger = logging.getLogger(__name__)

# Create database tables
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    # Placement schema evolves through Alembic, including existing attempt columns.
    Base.metadata.create_all(bind=engine, tables=[table for table in Base.metadata.sorted_tables if not table.name.startswith(("placement_", "exercise_", "weekly_learning_", "kanji_writing_", "chat_answer_feedback", "user_kanji_notes", "minigame_learning_", "flashcard_"))])
    dictionary_report = kanji_dictionary_service.validate()
    logger.info("[Dictionary] total entries: %s", dictionary_report["total_entries"])
    logger.info("[Dictionary] valid entries: %s", dictionary_report["valid_entries"])
    logger.info("[Dictionary] missing metadata: %s", dictionary_report["missing_metadata_count"])
    if get_model_info:
        model_info = get_model_info()
        logger.info("[Recognition] Dictionary classes: %s", model_info.get("dictionary_classes", 0))
        logger.info("[Recognition] Model classes: %s", model_info.get("classes_count", 0))
        if model_info.get("dictionary_classes") != model_info.get("classes_count"):
            logger.warning("[Recognition] %s", model_info.get("message"))
    if settings.reminders_enabled:
        start_reminder_scheduler()
    try:
        yield
    finally:
        stop_reminder_scheduler()

# Create FastAPI app
app = FastAPI(
    title="SenpaiAI - Japanese Learning Assistant",
    description="A comprehensive Japanese learning platform powered by LLM + RAG technology",
    version="1.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
allowed_origins = sorted(
    set(settings.allowed_origins)
    | {
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    }
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Export-Summary", "X-Export-Truncated"],
)

# Add trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.allowed_hosts
)

# Include routers
app.include_router(auth.router)
app.include_router(flashcards.router)
app.include_router(flashcards.router, prefix="/api")
app.include_router(learning.router)
app.include_router(learning.router, prefix="/api")
app.include_router(kanji_writing.router)
app.include_router(kanji_writing.router, prefix="/api")
app.include_router(placement.router)
app.include_router(placement.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(chat.router)
app.include_router(chat.router, prefix="/api")
app.include_router(chat_feedback.router)
app.include_router(chat_feedback.router, prefix="/api")
app.include_router(kanji_notes.router)
app.include_router(kanji_notes.router, prefix="/api")
app.include_router(minigame_learning.router)
app.include_router(minigame_learning.router, prefix="/api")
app.include_router(chat_conversations.router)
app.include_router(chat_conversations.router, prefix="/api")
app.include_router(analysis.router)
app.include_router(analysis.router, prefix="/api")
app.include_router(library.router)
app.include_router(library.api_router)
app.include_router(game.router)
app.include_router(game.router, prefix="/api")
app.include_router(kanji.router)
app.include_router(kanji.router, prefix="/api")
app.include_router(grammar_practice.router)
app.include_router(grammar_practice.router, prefix="/api")
app.include_router(grammar_lessons.router)
app.include_router(grammar_lessons.router, prefix="/api")
app.include_router(rewards.router)
app.include_router(rewards.router, prefix="/api")
app.include_router(daily.router)
app.include_router(daily.router, prefix="/api")
app.include_router(reminders.router)
app.include_router(reminders.router, prefix="/api")
app.include_router(notifications.router)
app.include_router(notifications.router, prefix="/api")
app.include_router(push.router)
app.include_router(push.router, prefix="/api")
app.include_router(listening.router)
app.include_router(listening.router, prefix="/api")
app.include_router(internship.router)
app.include_router(internship.router, prefix="/api")

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Welcome to SenpaiAI - Japanese Learning Assistant",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "features": [
            "JWT Authentication",
            "Japanese Q&A with RAG",
            "Grammar Analysis",
            "JLPT Level Prediction",
            "Japanese ↔ Vietnamese Translation",
            "Mini Games (Quiz, Flashcard)",
            "Learning History",
            "Document Search"
        ]
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "message": "SenpaiAI is running properly"
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.exception("Unhandled backend exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )

