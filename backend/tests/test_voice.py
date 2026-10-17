import pytest
from pydantic import ValidationError

from app.services.stt_service import (
    ALLOWED_AUDIO_MIME_TYPES,
    MAX_AUDIO_BYTES,
    validate_audio_upload,
)
from app.services.voice_scenarios import (
    SCENARIOS,
    build_recent_context,
    build_system_prompt,
)
from app.api.voice import serialize_feedback, check_transcribe_rate_limit


@pytest.mark.parametrize("level", ["N5", "N4", "N3"])
def test_prompt_uses_scenario_and_level(level):
    prompt = build_system_prompt("restaurant", level)
    assert SCENARIOS["restaurant"]["name"] in prompt
    assert level in prompt
    assert "tiếng Nhật" in prompt


def test_feedback_json_validation():
    valid = '{"corrected_sentence":"水をください","issues":[],"better_phrases":[]}'
    assert serialize_feedback(valid)["corrected_sentence"] == "水をください"
    with pytest.raises((ValueError, ValidationError)):
        serialize_feedback('{"corrected_sentence": 4, "issues": [], "better_phrases": []}')
    with pytest.raises(ValueError):
        serialize_feedback("not json")


@pytest.mark.parametrize("mime", sorted(ALLOWED_AUDIO_MIME_TYPES))
def test_allowed_audio_mime(mime):
    assert validate_audio_upload(mime + ";codecs=opus", 100) == mime


def test_audio_upload_limits():
    with pytest.raises(ValueError, match="unsupported_audio_type"):
        validate_audio_upload("audio/aac", 100)
    with pytest.raises(ValueError, match="audio_size_limit"):
        validate_audio_upload("audio/wav", MAX_AUDIO_BYTES + 1)


def test_transcription_rate_limit_per_user():
    user_id = 982314
    assert all(check_transcribe_rate_limit(user_id, now=100 + i) for i in range(10))
    assert not check_transcribe_rate_limit(user_id, now=109)
    assert check_transcribe_rate_limit(user_id, now=161)


def test_recent_context_uses_latest_turns_in_chronological_order():
    class Turn:
        def __init__(self, n):
            self.question, self.answer = f"q{n}", f"a{n}"

    context = build_recent_context([Turn(i) for i in range(8)], max_turns=3)
    assert context.index("q5") < context.index("q6") < context.index("q7")
    assert "q4" not in context
