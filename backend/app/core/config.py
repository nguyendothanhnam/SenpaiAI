from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://senpai:123456@localhost:5432/senpai_db"
    
    # Security
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # LLM Configuration
    llm_provider: str = "ollama"  # "openai" or "ollama"
    openai_api_key: Optional[str] = None
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma:2b"  # Default Gemma model
    
    # ChromaDB
    chroma_persist_directory: str = "./chroma_db"
    
    # CORS
    allowed_origins: list = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Rate Limiting
    rate_limit_per_minute: int = 60
    
    class Config:
        env_file = ".env"

settings = Settings()
