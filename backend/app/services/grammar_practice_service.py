"""Pure grading/validation helpers and persistence-facing grammar practice logic."""
import asyncio
import json
import random
import re
import unicodedata
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from pydantic import BaseModel, Field, ValidationError, model_validator

from .vocab_mcq_service import normalize_kana

QUESTION_TYPES = {"fill_blank", "reorder", "true_false", "conjugation"}
JLPT_LEVELS = {"N5", "N4", "N3", "N2", "N1"}


def _answer_strings(value: Any) -> List[str]:
    values = value if isinstance(value, list) else [value]
    return [str(item) for item in values if isinstance(item, (str, int, float))]


def normalize_conjugation(value: str) -> str:
    return normalize_kana(unicodedata.normalize("NFKC", value).strip())


def grade_answer(question_type: str, answer: Any, correct_answer: Any, accepted_answers: Any = None) -> bool:
    """Grade one client answer without accessing the database."""
    accepted = _answer_strings(accepted_answers)
    correct = _answer_strings(correct_answer)
    candidates = correct + accepted
    if question_type == "fill_blank":
        return isinstance(answer, str) and answer in candidates
    if question_type == "reorder":
        if not isinstance(answer, list) or not all(isinstance(token, str) for token in answer):
            return False
        joined = "".join(answer)
        return joined in candidates
    if question_type == "true_false":
        return isinstance(answer, bool) and isinstance(correct_answer, bool) and answer is correct_answer
    if question_type == "conjugation":
        if not isinstance(answer, str):
            return False
        normalized = normalize_conjugation(answer)
        return normalized in {normalize_conjugation(item) for item in candidates}
    return False


def _shuffled(values: Sequence[str], rng: Optional[random.Random] = None) -> List[str]:
    result = list(values)
    (rng or random).shuffle(result)
    return result


def public_question(question: Any, rule: Any = None, rng: Optional[random.Random] = None) -> Dict[str, Any]:
    """Build the client-safe question representation; never returns answers/explanations."""
    payload = question.payload or {}
    result: Dict[str, Any] = {
        "id": question.id,
        "question_type": question.question_type,
        "jlpt_level": question.jlpt_level,
        "grammar_rule": ({"id": rule.id, "rule_name": rule.rule_name} if rule else None),
        "prompt": question.prompt,
    }
    if question.question_type == "fill_blank":
        result["options"] = _shuffled(payload.get("options", []), rng)
    elif question.question_type == "reorder":
        result["tokens"] = _shuffled(payload.get("tokens", []), rng)
    elif question.question_type == "true_false":
        result["statement"] = payload.get("statement", question.prompt)
    elif question.question_type == "conjugation":
        result["base_form"] = payload.get("base_form", "")
        result["target_form"] = payload.get("target_form", "")
    return result


def choose_questions(questions: Sequence[Any], count: int, attempted_ids: Iterable[int] = (), rng: Optional[random.Random] = None) -> List[Any]:
    """Prefer unseen questions, then previously incorrect questions, before seen correct ones."""
    attempted = set(attempted_ids)
    pool = list(questions)
    unseen = [q for q in pool if q.id not in attempted]
    seen = [q for q in pool if q.id in attempted]
    (rng or random).shuffle(unseen)
    (rng or random).shuffle(seen)
    return (unseen + seen)[:count]


class GeneratedQuestion(BaseModel):
    jlpt_level: str
    question_type: str
    prompt: str = Field(min_length=1)
    payload: Dict[str, Any] = Field(default_factory=dict)
    correct_answer: Any
    accepted_answers: Optional[List[str]] = None
    explanation_vi: str = Field(min_length=1)
    examples: List[Dict[str, str]] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_question(self):
        if self.jlpt_level not in JLPT_LEVELS:
            raise ValueError("jlpt_level không hợp lệ")
        if self.question_type not in QUESTION_TYPES:
            raise ValueError("question_type không hợp lệ")
        if not self.explanation_vi.strip():
            raise ValueError("Cần giải thích tiếng Việt")
        if any(not item.get("ja", "").strip() or not item.get("vi", "").strip() for item in self.examples):
            raise ValueError("Mỗi ví dụ cần có ja và vi")
        if self.question_type == "fill_blank":
            options = self.payload.get("options")
            if not isinstance(options, list) or len(options) != 4 or len(set(map(str, options))) != 4:
                raise ValueError("fill_blank cần đúng 4 lựa chọn khác nhau")
            if len(re.findall(r"_{2,}|[…]{2,}|（　）", self.prompt)) != 1:
                raise ValueError("fill_blank cần đúng một chỗ trống")
            if self.correct_answer not in options:
                raise ValueError("đáp án phải thuộc options")
        elif self.question_type == "reorder":
            tokens = self.payload.get("tokens")
            if not isinstance(tokens, list) or not 4 <= len(tokens) <= 8 or not all(isinstance(x, str) and x for x in tokens):
                raise ValueError("reorder cần 4–8 token")
            if "".join(tokens) != self.correct_answer:
                raise ValueError("ghép tokens phải bằng đáp án")
        elif self.question_type == "true_false":
            if not self.payload.get("statement") or not isinstance(self.correct_answer, bool):
                raise ValueError("true_false cần mệnh đề và đáp án boolean")
            explanation = self.explanation_vi.casefold()
            if len(explanation.strip()) < 8 or not any(word in explanation for word in ("đúng", "sai", "vì")):
                raise ValueError("giải thích true_false cần nêu lý do đúng/sai")
        elif self.question_type == "conjugation":
            if not self.payload.get("base_form") or not self.payload.get("target_form"):
                raise ValueError("conjugation cần dạng gốc và thể cần đổi")
            if not _answer_strings(self.correct_answer):
                raise ValueError("conjugation cần ít nhất một đáp án")
        return self


def parse_generated_questions(raw: str, jlpt_level: str, question_type: str) -> Tuple[List[GeneratedQuestion], int]:
    """Parse JSON or fenced JSON and validate records independently."""
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE)
    try:
        parsed = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return [], 1
    if isinstance(parsed, dict):
        parsed = parsed.get("questions", [])
    if not isinstance(parsed, list):
        return [], 1
    valid, rejected = [], 0
    for item in parsed:
        try:
            if isinstance(item, dict):
                item.setdefault("jlpt_level", jlpt_level)
                item.setdefault("question_type", question_type)
            valid.append(GeneratedQuestion.model_validate(item))
        except (ValidationError, TypeError, ValueError):
            rejected += 1
    return valid, rejected


def is_duplicate_question(prompt: str, question_type: str, existing: Iterable[Tuple[str, str]]) -> bool:
    key = (" ".join(prompt.casefold().split()), question_type)
    return key in {(" ".join(p.casefold().split()), kind) for p, kind in existing}


async def generate_raw_questions(jlpt_level: str, rule_name: str, question_type: str, count: int) -> str:
    """Use configured provider without modifying existing LLM/game service functions."""
    prompt = f"""Tạo {count} câu luyện ngữ pháp tiếng Nhật cấp {jlpt_level} cho mẫu {rule_name}, dạng {question_type}.
Chỉ trả JSON object {{\"questions\":[...]}}. Mỗi câu có prompt, payload, correct_answer, accepted_answers (nếu có), explanation_vi, examples (mảng {{ja,vi}}).
fill_blank: prompt có đúng một ____; payload.options đúng 4 phương án khác nhau.
reorder: payload.tokens có 4-8 token theo đúng thứ tự; correct_answer là câu nối token.
true_false: payload.statement, correct_answer boolean, giải thích tiếng Việt nêu vì sao đúng/sai.
conjugation: payload.base_form, payload.target_form, correct_answer chuỗi hoặc danh sách đáp án.
Ví dụ examples dùng khóa ja và vi. Nội dung ngữ pháp phải chính xác."""
    if settings_provider() == "ollama":
        from .ollama_service import ollama_service
        return await asyncio.to_thread(ollama_service._call_ollama, prompt, "Chỉ xuất JSON hợp lệ, không Markdown.")
    from .llm_service import japanese_service
    response = await japanese_service.llm.agenerate([[__import__("langchain_core.messages", fromlist=["HumanMessage"]).HumanMessage(content=prompt)]])
    return response.generations[0][0].text


def settings_provider() -> str:
    from ..core.config import settings
    return settings.llm_provider
