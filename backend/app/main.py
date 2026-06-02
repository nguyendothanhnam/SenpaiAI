from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import os
import logging

from .core.config import settings
from .core.database import engine, Base
from .api import auth, chat, analysis, library, game, kanji
from .services.kanji_dictionary_service import kanji_dictionary_service

try:
    from ml.kanji_recognizer import get_model_info
except ImportError:  # pragma: no cover - optional ML runtime
    get_model_info = None

logger = logging.getLogger(__name__)

# Create database tables
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
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
    yield
    # Shutdown
    pass

# Create FastAPI app
app = FastAPI(
    title="HineGoldAI - Japanese Learning Assistant",
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
)

# Add trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "0.0.0.0"]
)

# Include routers
app.include_router(auth.router)
app.include_router(auth.router, prefix="/api")
app.include_router(chat.router)
app.include_router(chat.router, prefix="/api")
app.include_router(analysis.router)
app.include_router(analysis.router, prefix="/api")
app.include_router(library.router)
app.include_router(library.api_router)
app.include_router(game.router)
app.include_router(game.router, prefix="/api")
app.include_router(kanji.router)
app.include_router(kanji.router, prefix="/api")

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

