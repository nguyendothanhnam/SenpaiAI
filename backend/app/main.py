from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import os

from .core.config import settings
from .core.database import engine, Base
from .api import auth, chat, analysis, library, game, kanji

# Create database tables
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown
    pass

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
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
app.include_router(chat.router)
app.include_router(analysis.router)
app.include_router(library.router)
app.include_router(game.router)
app.include_router(kanji.router)

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
    return HTTPException(
        status_code=500,
        detail=f"Internal server error: {str(exc)}"
    )

