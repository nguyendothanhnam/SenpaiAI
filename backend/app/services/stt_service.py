"""Lazy local speech-to-text service. Audio is decoded and processed in memory."""
import asyncio
from functools import lru_cache
from io import BytesIO
import math
from typing import Any

from ..core.config import settings

MAX_AUDIO_BYTES = 5 * 1024 * 1024
MAX_AUDIO_SECONDS = 60
ALLOWED_AUDIO_MIME_TYPES = {"audio/webm", "audio/ogg", "audio/wav", "audio/mp4"}


def validate_audio_upload(content_type: str | None, size: int) -> str:
    mime = (content_type or "").split(";", 1)[0].strip().lower()
    if mime not in ALLOWED_AUDIO_MIME_TYPES:
        raise ValueError("unsupported_audio_type")
    if size <= 0 or size > MAX_AUDIO_BYTES:
        raise ValueError("audio_size_limit")
    return mime


def _decode_audio(audio_bytes: bytes):
    try:
        import av
        import numpy as np
    except ImportError as exc:
        raise RuntimeError("Bộ giải mã âm thanh chưa sẵn sàng (PyAV). Hãy cài lại faster-whisper.") from exc
    try:
        container = av.open(BytesIO(audio_bytes))
        if container.duration and container.duration / av.time_base > MAX_AUDIO_SECONDS:
            raise ValueError("audio_duration_limit")
        stream = next((s for s in container.streams if s.type == "audio"), None)
        if stream is None:
            raise ValueError("invalid_audio")
        resampler = av.AudioResampler(format="fltp", layout="mono", rate=16000)
        chunks = []
        samples = 0
        for frame in container.decode(stream):
            for converted in resampler.resample(frame):
                chunk = converted.to_ndarray().reshape(-1)
                samples += len(chunk)
                if samples > MAX_AUDIO_SECONDS * 16000:
                    raise ValueError("audio_duration_limit")
                chunks.append(chunk)
        if not chunks:
            raise ValueError("invalid_audio")
        return np.concatenate(chunks).astype(np.float32, copy=False)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("invalid_audio") from exc


@lru_cache(maxsize=1)
def _get_model():
    try:
        from faster_whisper import WhisperModel
        return WhisperModel(settings.whisper_model_size, device=settings.whisper_device,
                            compute_type="int8" if settings.whisper_device == "cpu" else "float16",
                            download_root=settings.whisper_model_dir)
    except Exception as exc:
        raise RuntimeError(
            f"Whisper chưa sẵn sàng: không tải được model '{settings.whisper_model_size}'. "
            "Kiểm tra kết nối lần chạy đầu và volume WHISPER_MODEL_DIR."
        ) from exc


def _transcribe_sync(audio_bytes: bytes) -> dict[str, Any]:
    audio = _decode_audio(audio_bytes)
    model = _get_model()
    segments, info = model.transcribe(audio, beam_size=5, vad_filter=True)
    results = []
    confidence_values = []
    for segment in segments:
        no_speech = max(0.0, min(1.0, float(segment.no_speech_prob or 0)))
        confidence = max(0.0, min(1.0, math.exp(min(0.0, float(segment.avg_logprob))) * (1 - no_speech)))
        confidence_values.append(confidence)
        results.append({"start": segment.start, "end": segment.end, "text": segment.text.strip(),
                        "avg_logprob": segment.avg_logprob, "no_speech_prob": segment.no_speech_prob})
    text = " ".join(part["text"] for part in results).strip()
    return {"text": text, "language": info.language,
            "confidence": sum(confidence_values) / len(confidence_values) if confidence_values else 0.0,
            "segments": results}


async def transcribe_audio(audio_bytes: bytes) -> dict[str, Any]:
    return await asyncio.to_thread(_transcribe_sync, audio_bytes)
