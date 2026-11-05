from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path
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
    allowed_hosts: list[str] = ["localhost", "127.0.0.1", "0.0.0.0", "10.0.2.2"]
    
    # Rate Limiting
    rate_limit_per_minute: int = 60

    # Chat conversations and folders.
    chat_max_folders: int = 30
    chat_folder_name_max_length: int = 60
    chat_conversation_title_max_length: int = 80
    chat_history_group_gap_hours: int = 6
    chat_context_max_turns: int = 6
    chat_context_max_chars: int = 6000
    chat_messages_page_size: int = 30
    chat_messages_page_max_size: int = 100

    # Application calendar and development-only reward tools
    app_timezone: str = "Asia/Ho_Chi_Minh"
    enable_dev_rewards: bool = False

    # In-process reminder scheduler and optional Web Push credentials.
    reminders_enabled: bool = True
    vapid_public_key: Optional[str] = None
    vapid_private_key: Optional[str] = None
    vapid_subject: str = "mailto:admin@senpaiai.local"

    whisper_model_size: str = "small"
    whisper_device: str = "cpu"
    whisper_model_dir: str = "/app/models"

    # Local backend development uses the host-published VOICEVOX port. Docker
    # Compose overrides this with its internal service URL.
    voicevox_url: str = "http://localhost:50021"
    listening_media_dir: str = str(Path(__file__).resolve().parents[2] / "media" / "audio")
    listening_voicevox_speaker_id: int = 1
    
    class Config:
        env_file = ".env"

settings = Settings()
