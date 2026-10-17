"""TTS providers and WAV assembly/cache for listening lessons."""
from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from typing import Protocol, Sequence
import json
import os
import tempfile
import wave

import httpx

from ..core.config import settings

PAUSE_BETWEEN_SEGMENTS_MS = 400
VOICEVOX_TIMEOUT_SECONDS = 20.0


class TTSProvider(Protocol):
    provider_name: str

    def synthesize(self, text: str, speaker_id: int) -> bytes: ...
    def list_speakers(self) -> list[dict]: ...


class VoicevoxError(RuntimeError):
    pass


class VoicevoxProvider:
    provider_name = "voicevox"

    def __init__(self, base_url: str | None = None, timeout: float = VOICEVOX_TIMEOUT_SECONDS):
        self.base_url = (base_url or settings.voicevox_url).rstrip("/")
        self.timeout = timeout

    def list_speakers(self) -> list[dict]:
        try:
            response = httpx.get(f"{self.base_url}/speakers", timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise VoicevoxError(f"Không thể lấy danh sách giọng VOICEVOX: {exc}") from exc

    def synthesize(self, text: str, speaker_id: int) -> bytes:
        try:
            query = httpx.post(f"{self.base_url}/audio_query", params={"text": text, "speaker": speaker_id},
                               timeout=self.timeout)
            query.raise_for_status()
            result = httpx.post(f"{self.base_url}/synthesis", params={"speaker": speaker_id},
                                json=query.json(), timeout=self.timeout)
            result.raise_for_status()
            payload = result.content
            with wave.open(BytesIO(payload), "rb") as wav:
                if wav.getnframes() == 0:
                    raise VoicevoxError("VOICEVOX trả về âm thanh rỗng.")
            return payload
        except VoicevoxError:
            raise
        except (httpx.HTTPError, ValueError, wave.Error) as exc:
            raise VoicevoxError(f"VOICEVOX không tạo được âm thanh: {exc}") from exc


def choose_speaker_id(provider: TTSProvider, preferred_id: int | None = None) -> int:
    try:
        speakers = provider.list_speakers()
    except Exception as exc:
        raise VoicevoxError(f"Không thể đọc danh sách giọng VOICEVOX: {exc}") from exc
    if not isinstance(speakers, list):
        raise VoicevoxError("VOICEVOX /speakers trả về dữ liệu không hợp lệ.")
    available = [style["id"] for speaker in speakers for style in speaker.get("styles", []) if "id" in style]
    if preferred_id is not None and preferred_id in available:
        return preferred_id
    if available:
        return available[0]
    raise VoicevoxError("VOICEVOX /speakers không trả về giọng nào khả dụng.")


@dataclass
class AssembledAudio:
    wav_bytes: bytes
    duration_ms: int
    timings: list[dict[str, int]]
    cache_key: str


def make_cache_key(texts: Sequence[str], speaker_id: int, provider_name: str = "voicevox") -> str:
    canonical = json.dumps({"provider": provider_name, "speaker": speaker_id, "texts": list(texts)},
                           ensure_ascii=False, separators=(",", ":"))
    return sha256(canonical.encode("utf-8")).hexdigest()


def _read_wav(payload: bytes):
    with wave.open(BytesIO(payload), "rb") as wav:
        params = wav.getparams()
        frames = wav.readframes(wav.getnframes())
    return params, frames


def assemble_wav(segments: Sequence[str], clips: Sequence[bytes], cache_key: str = "") -> AssembledAudio:
    if not segments or len(segments) != len(clips):
        raise ValueError("Cần một tệp âm thanh tương ứng cho mỗi câu.")
    parsed = [_read_wav(clip) for clip in clips]
    params = parsed[0][0]
    if params.comptype != "NONE":
        raise ValueError("VOICEVOX phải trả WAV PCM không nén.")
    if any(p[:3] != params[:3] or p.comptype != params.comptype for p, _ in parsed):
        raise ValueError("Các câu có thông số WAV không đồng nhất.")
    silence_frames = int(params.framerate * PAUSE_BETWEEN_SEGMENTS_MS / 1000)
    silence = b"\x00" * silence_frames * params.nchannels * params.sampwidth
    all_frames = []
    timings: list[dict[str, int]] = []
    cursor_frames = 0
    for index, (clip_params, frames) in enumerate(parsed):
        start_ms = round(cursor_frames * 1000 / params.framerate)
        frame_count = len(frames) // (params.nchannels * params.sampwidth)
        end_ms = round((cursor_frames + frame_count) * 1000 / params.framerate)
        timings.append({"idx": index, "start_ms": start_ms, "end_ms": end_ms})
        all_frames.append(frames)
        cursor_frames += frame_count
        if index < len(parsed) - 1:
            all_frames.append(silence)
            cursor_frames += silence_frames
    output = BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setparams(params)
        wav.writeframes(b"".join(all_frames))
    duration_ms = round(cursor_frames * 1000 / params.framerate)
    return AssembledAudio(output.getvalue(), duration_ms, timings, cache_key)


def synthesize_segments(texts: Sequence[str], speaker_id: int = 1,
                        provider: TTSProvider | None = None,
                        media_dir: str | Path | None = None) -> tuple[str, AssembledAudio]:
    provider = provider or VoicevoxProvider()
    root = Path(media_dir or settings.listening_media_dir)
    root.mkdir(parents=True, exist_ok=True)
    key = make_cache_key(texts, speaker_id, provider.provider_name)
    wav_path = root / f"{key}.wav"
    meta_path = root / f"{key}.json"
    if wav_path.is_file() and meta_path.is_file():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            return wav_path.name, AssembledAudio(wav_path.read_bytes(), meta["duration_ms"], meta["timings"], key)
        except (OSError, ValueError, KeyError, json.JSONDecodeError):
            pass
    clips = [provider.synthesize(text, speaker_id) for text in texts]
    assembled = assemble_wav(texts, clips, key)
    _atomic_write(wav_path, assembled.wav_bytes)
    _atomic_write(meta_path, json.dumps({"duration_ms": assembled.duration_ms,
                                         "timings": assembled.timings}, ensure_ascii=False).encode("utf-8"))
    return wav_path.name, assembled


def _atomic_write(path: Path, content: bytes) -> None:
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temp:
            temp.write(content)
            temp_path = Path(temp.name)
        os.replace(temp_path, path)
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()


def furigana_tokens(text: str) -> list[dict[str, str]]:
    try:
        from pykakasi import kakasi
        converter = kakasi()
        return [{"text": token["orig"], "reading": token.get("hira", token["orig"])}
                for token in converter.convert(text)]
    except ImportError as exc:
        raise RuntimeError("Thiếu pykakasi để tạo furigana; hãy cài requirements.txt.") from exc
