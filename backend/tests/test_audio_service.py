from io import BytesIO
import wave

import httpx
import pytest

from app.api.listening import parse_range_header
from app.services.audio_service import (
    PAUSE_BETWEEN_SEGMENTS_MS,
    VoicevoxError,
    VoicevoxProvider,
    assemble_wav,
    furigana_tokens,
    make_cache_key,
)


def _wav(seconds: float, rate: int = 1000) -> bytes:
    output = BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(rate)
        audio.writeframes(b"\x01\x00" * int(seconds * rate))
    return output.getvalue()


def test_wav_assembly_has_exact_pauses_and_segment_times():
    result = assemble_wav(["first", "second"], [_wav(1), _wav(0.5)])
    assert result.timings == [
        {"idx": 0, "start_ms": 0, "end_ms": 1000},
        {"idx": 1, "start_ms": 1000 + PAUSE_BETWEEN_SEGMENTS_MS, "end_ms": 1900},
    ]
    assert result.duration_ms == 1900
    with wave.open(BytesIO(result.wav_bytes), "rb") as audio:
        assert round(audio.getnframes() * 1000 / audio.getframerate()) == 1900


def test_cache_key_is_stable_and_depends_on_text_and_voice():
    key = make_cache_key(["こんにちは", "元気ですか"], 1)
    assert key == make_cache_key(["こんにちは", "元気ですか"], 1)
    assert key != make_cache_key(["こんにちは"], 1)
    assert key != make_cache_key(["こんにちは", "元気ですか"], 2)


def test_furigana_tokens_include_text_and_reading():
    tokens = furigana_tokens("日本語を勉強します。")
    assert tokens
    assert all(set(token) == {"text", "reading"} for token in tokens)
    assert "日本語" in "".join(token["text"] for token in tokens)


def test_voicevox_unavailable_has_clear_timeout_error(monkeypatch):
    def timeout(*args, **kwargs):
        assert kwargs["timeout"] == 0.01
        raise httpx.ReadTimeout("timed out")

    monkeypatch.setattr(httpx, "post", timeout)
    provider = VoicevoxProvider("http://voicevox.invalid", timeout=0.01)
    with pytest.raises(VoicevoxError, match="VOICEVOX không tạo được âm thanh"):
        provider.synthesize("こんにちは", 1)


@pytest.mark.parametrize(
    ("header", "expected"),
    [("bytes=0-9", (0, 9)), ("bytes=10-", (10, 99)), ("bytes=-5", (95, 99)), ("bytes=100-", None)],
)
def test_audio_range_parser(header, expected):
    assert parse_range_header(header, 100) == expected
