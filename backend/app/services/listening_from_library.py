"""Create draft listening dialogues grounded in Library documents."""
import asyncio
import json
import re
from typing import Any

from ..core.config import settings


async def generate_listening_draft(document_text: str, jlpt_level: str, topic: str) -> dict[str, Any]:
    context = document_text[:24000]
    prompt = f"""Viết một hội thoại học tiếng Nhật ngắn khoảng 6 lượt/câu, cấp {jlpt_level}, chủ đề {topic or 'phù hợp tài liệu'}, bám sát thông tin và mẫu câu trong tài liệu.
Chỉ trả về JSON theo cấu trúc: {{"title":"tiêu đề tiếng Việt","description":"mô tả ngắn tiếng Việt","segments":[{{"ja":"câu tiếng Nhật","vi":"bản dịch tiếng Việt"}}]}}.
Mỗi câu phải tự nhiên, có đủ ja và vi, không thêm trường ngoài. Không bịa dữ kiện trái với tài liệu.
Tài liệu:
---
{context}
---"""
    if settings.llm_provider == "ollama":
        from .ollama_service import ollama_service
        raw = await asyncio.to_thread(ollama_service._call_ollama, prompt, "Chỉ xuất JSON hợp lệ, không Markdown.")
    else:
        from .llm_service import japanese_service
        human_message = __import__("langchain_core.messages", fromlist=["HumanMessage"]).HumanMessage
        response = await japanese_service.llm.agenerate([[human_message(content=prompt)]])
        raw = response.generations[0][0].text

    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.IGNORECASE)
    try:
        draft = json.loads(cleaned)
    except (json.JSONDecodeError, TypeError) as exc:
        raise ValueError("LLM returned invalid JSON") from exc
    if not isinstance(draft, dict) or not isinstance(draft.get("segments"), list):
        raise ValueError("Draft must contain segments")
    segments = draft["segments"]
    if not 4 <= len(segments) <= 10:
        raise ValueError("Draft must contain 4 to 10 dialogue lines")
    normalized = []
    for index, segment in enumerate(segments, 1):
        if not isinstance(segment, dict):
            raise ValueError("Each segment must be an object")
        ja = segment.get("ja")
        vi = segment.get("vi")
        if not isinstance(ja, str) or not isinstance(vi, str) or not ja.strip() or not vi.strip():
            raise ValueError("Each segment requires Japanese and Vietnamese text")
        if len(ja) > 300 or len(vi) > 500:
            raise ValueError("Segment text is too long")
        normalized.append({"idx": index, "ja": ja.strip(), "vi": vi.strip()})
    title = draft.get("title")
    description = draft.get("description", "")
    if not isinstance(title, str) or not title.strip() or len(title) > 200:
        raise ValueError("Draft title is invalid")
    if not isinstance(description, str) or len(description) > 1000:
        raise ValueError("Draft description is invalid")
    return {"title": title.strip(), "description": description.strip(), "segments": normalized}
