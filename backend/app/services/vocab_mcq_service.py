import re
import unicodedata
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass(frozen=True)
class VocabEntry:
    kana: str
    kanji: str
    vi: List[str]
    en: List[str]
    jlpt: str
    example_ja: str
    example_vi: str
    breakdown: List[str]


@dataclass(frozen=True)
class McqOption:
    label: str
    text: str


@dataclass(frozen=True)
class VocabMcqResult:
    answer: str
    target: str
    matched_label: Optional[str]
    matched_text: Optional[str]
    intent: str


VOCABULARY: Dict[str, VocabEntry] = {
    "がくせい": VocabEntry("がくせい", "学生", ["học sinh", "sinh viên", "học sinh / sinh viên"], ["student"], "N5", "私は学生です。", "Tôi là sinh viên.", ["学 = học", "生 = người học / sinh"]),
    "学生": VocabEntry("がくせい", "学生", ["học sinh", "sinh viên", "học sinh / sinh viên"], ["student"], "N5", "私は学生です。", "Tôi là sinh viên.", ["学 = học", "生 = người học / sinh"]),
    "せんせい": VocabEntry("せんせい", "先生", ["giáo viên", "thầy giáo", "cô giáo"], ["teacher"], "N5", "先生に聞きます。", "Tôi hỏi giáo viên.", ["先 = trước", "生 = sinh / người"]),
    "先生": VocabEntry("せんせい", "先生", ["giáo viên", "thầy giáo", "cô giáo"], ["teacher"], "N5", "先生に聞きます。", "Tôi hỏi giáo viên.", ["先 = trước", "生 = sinh / người"]),
    "いしゃ": VocabEntry("いしゃ", "医者", ["bác sĩ"], ["doctor"], "N5", "医者に行きます。", "Tôi đi gặp bác sĩ.", ["医 = y", "者 = người"]),
    "医者": VocabEntry("いしゃ", "医者", ["bác sĩ"], ["doctor"], "N5", "医者に行きます。", "Tôi đi gặp bác sĩ.", ["医 = y", "者 = người"]),
    "しゃいん": VocabEntry("しゃいん", "社員", ["nhân viên"], ["employee"], "N5", "兄は会社の社員です。", "Anh trai tôi là nhân viên công ty.", ["社 = công ty", "員 = thành viên"]),
    "社員": VocabEntry("しゃいん", "社員", ["nhân viên"], ["employee"], "N5", "兄は会社の社員です。", "Anh trai tôi là nhân viên công ty.", ["社 = công ty", "員 = thành viên"]),
}

DISTRACTOR_LOOKUP = {
    "giao vien": "せんせい / 先生",
    "thay giao": "せんせい / 先生",
    "co giao": "せんせい / 先生",
    "hoc sinh": "がくせい / 学生",
    "sinh vien": "がくせい / 学生",
    "nhan vien": "しゃいん / 社員",
    "bac si": "いしゃ / 医者",
}

OPTION_PATTERN = re.compile(
    r"(?P<label>[A-DＡ-Ｄ])\s*[\.\)]\s*(?P<text>.*?)(?=(?:\s+[A-DＡ-Ｄ]\s*[\.\)])|$)",
    re.IGNORECASE | re.DOTALL,
)
QUOTE_PATTERN = re.compile(r"[「『\"']\s*(?P<target>[^」』\"']+?)\s*[」』\"']")
JAPANESE_PATTERN = re.compile(r"[\u3040-\u30ff\u3400-\u9fff]+")


def normalize_kana(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value.strip())
    chars = []
    for char in normalized:
        code = ord(char)
        chars.append(chr(code - 0x60) if 0x30A1 <= code <= 0x30F6 else char)
    return "".join(chars)


def strip_accents(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).casefold()
    return "".join(char for char in value if not unicodedata.combining(char))


def normalize_text(value: str) -> str:
    value = strip_accents(unicodedata.normalize("NFKC", value))
    return re.sub(r"[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+", " ", value).strip()


def detect_intent(message: str, options: List[McqOption]) -> Optional[str]:
    normalized = normalize_text(message)
    if options:
        return "jlpt_multiple_choice"
    if "co nghia la gi" in normalized or "nghia la gi" in normalized or "mean" in normalized:
        return "vocabulary"
    return None


def parse_options(message: str) -> List[McqOption]:
    options = []
    for match in OPTION_PATTERN.finditer(message):
        label = unicodedata.normalize("NFKC", match.group("label")).upper()
        text = " ".join(match.group("text").strip().split())
        if text:
            options.append(McqOption(label=label, text=text))
    return options


def extract_target(message: str) -> Optional[str]:
    quoted = QUOTE_PATTERN.search(message)
    if quoted:
        return normalize_kana(quoted.group("target"))

    japanese_terms = JAPANESE_PATTERN.findall(message)
    if japanese_terms:
        return normalize_kana(japanese_terms[0])
    return None


def lookup_vocab(target: str) -> Optional[VocabEntry]:
    normalized = normalize_kana(target)
    return VOCABULARY.get(normalized)


def option_matches_entry(option: McqOption, entry: VocabEntry) -> bool:
    normalized_option = normalize_text(option.text)
    return any(normalize_text(term) in normalized_option for term in [*entry.vi, *entry.en])


def explain_distractor(option: McqOption) -> Optional[str]:
    normalized_option = normalize_text(option.text)
    for meaning, japanese in DISTRACTOR_LOOKUP.items():
        if meaning in normalized_option:
            return f"{option.label}. {option.text} = {japanese}"
    return None


def _format_entry(entry: VocabEntry, matched: Optional[McqOption], uncertain: bool = False) -> str:
    prefix = "Không chắc chắn, đây là các khả năng:" if uncertain else None
    lines = []
    if prefix:
        lines.append(prefix)
        lines.append("")

    if matched:
        lines.append(f"Đáp án đúng: {matched.label}. {matched.text}")
        lines.append("")

    lines.extend(
        [
            f"「{entry.kana}」({entry.kanji})",
            f"= {entry.vi[-1]}",
            "",
            "Giải thích:",
            f"{entry.kanji} = {entry.vi[-1]}",
            *entry.breakdown,
            "",
            "Ví dụ:",
            entry.example_ja,
            f"→ {entry.example_vi}",
            "",
            f"JLPT: {entry.jlpt} Vocabulary",
        ]
    )
    return "\n".join(lines)


def try_answer(message: str) -> Optional[VocabMcqResult]:
    options = parse_options(message)
    intent = detect_intent(message, options)
    if not intent:
        return None

    target = extract_target(message)
    if not target:
        return None

    entry = lookup_vocab(target)
    if not entry:
        return VocabMcqResult(
            answer="Không chắc chắn, đây là các khả năng. Mình chưa thấy từ này trong từ điển cục bộ, nên cần tra thêm trước khi kết luận.",
            target=target,
            matched_label=None,
            matched_text=None,
            intent=intent,
        )

    matched = next((option for option in options if option_matches_entry(option, entry)), None)
    if options and not matched:
        return VocabMcqResult(
            answer=_format_entry(entry, None, uncertain=True),
            target=target,
            matched_label=None,
            matched_text=None,
            intent=intent,
        )

    return VocabMcqResult(
        answer=_format_entry(entry, matched),
        target=target,
        matched_label=matched.label if matched else None,
        matched_text=matched.text if matched else None,
        intent=intent,
    )
