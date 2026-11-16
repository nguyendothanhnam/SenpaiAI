#!/usr/bin/env python3
"""
Script nhập học liệu tiếng Nhật (Kanji, Từ vựng, Ngữ pháp, Hội thoại)
từ CSV, JSON hoặc Markdown vào cơ sở dữ liệu PostgreSQL và Vector Store (RAG).

Hỗ trợ:
- Định dạng: JSON, CSV, Markdown (.md)
- Phân loại: kanji, vocabulary, grammar, conversation, lesson, example
- Cấp độ JLPT: N5, N4, N3, N2, N1
- Tự động lập chỉ mục vector đa ngôn ngữ (Ollama nomic-embed-text)
- Cơ chế Upsert (chạy nhiều lần không trùng lặp)

Cách chạy:
    python scripts/import_knowledge_library.py --file app/data/japanese_knowledge_seed.json
    python scripts/import_knowledge_library.py --file data.csv --format csv
    python scripts/import_knowledge_library.py --file notes.md --format md
    python scripts/import_knowledge_library.py --file app/data/japanese_knowledge_seed.json --dry-run
"""

import argparse
import csv
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Thêm thư mục backend vào sys.path để import được app modules
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

ALLOWED_TYPES = {"kanji", "vocabulary", "grammar", "conversation", "lesson", "culture", "example"}
JLPT_LEVELS = {"N5", "N4", "N3", "N2", "N1"}


def format_item_content(item: Dict[str, Any]) -> tuple[str, str]:
    """
    Tạo tiêu đề chuẩn và nội dung tối ưu hóa cho semantic search & đọc hiểu.
    Trả về (title, content).
    """
    doc_type = (item.get("type") or item.get("document_type") or "vocabulary").strip().lower()
    level = (item.get("level") or item.get("jlpt_level") or "").strip().upper()
    japanese = (item.get("japanese") or "").strip()
    reading = (item.get("reading") or "").strip()
    meaning_vi = (item.get("meaning_vi") or item.get("meaning") or "").strip()
    notes = (item.get("notes") or "").strip()
    strokes = item.get("stroke_count") or item.get("strokes")

    # Nếu item đã có sẵn title và content (dạng document thuần túy)
    if "title" in item and "content" in item and not japanese:
        return item["title"].strip(), item["content"].strip()

    type_prefix_map = {
        "kanji": "Hán tự",
        "vocabulary": "Từ vựng",
        "grammar": "Ngữ pháp",
        "conversation": "Hội thoại",
        "lesson": "Bài học",
        "example": "Ví dụ",
    }
    type_display = type_prefix_map.get(doc_type, doc_type.capitalize())

    short_meaning = (meaning_vi.split("\n")[0])[:50]
    reading_part = f" ({reading})" if reading else ""
    title = f"{type_display}: {japanese}{reading_part} - {short_meaning}".strip()

    content_lines = [
        f"【{type_display}】: {japanese}",
    ]
    if reading:
        content_lines.append(f"【Cách đọc / Furigana】: {reading}")
    if meaning_vi:
        content_lines.append(f"【Ý nghĩa tiếng Việt】: {meaning_vi}")
    if level:
        content_lines.append(f"【Cấp độ JLPT】: {level}")
    if strokes:
        content_lines.append(f"【Số nét】: {strokes}")

    examples = item.get("examples") or []
    if examples:
        content_lines.append("\n【Câu ví dụ & Hội thoại mẫu】:")
        for idx, ex in enumerate(examples, 1):
            if isinstance(ex, dict):
                s_ja = ex.get("sentence_ja") or ex.get("sentence") or ex.get("ja") or ""
                s_rd = ex.get("reading") or ex.get("furigana") or ""
                s_vi = ex.get("meaning_vi") or ex.get("meaning") or ex.get("vi") or ""
                ex_text = f"{idx}. {s_ja}"
                if s_rd:
                    ex_text += f"\n   Cách đọc: {s_rd}"
                if s_vi:
                    ex_text += f"\n   Dịch nghĩa: {s_vi}"
                content_lines.append(ex_text)
            elif isinstance(ex, str):
                content_lines.append(f"{idx}. {ex}")

    if notes:
        content_lines.append(f"\n【Ghi chú ngữ cảnh & Văn hóa】: {notes}")

    content = "\n".join(content_lines)
    return title, content


def parse_json_file(file_path: Path) -> List[Dict[str, Any]]:
    """Đọc dữ liệu từ file JSON."""
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    elif isinstance(data, dict):
        if "items" in data and isinstance(data["items"], list):
            return data["items"]
        if "documents" in data and isinstance(data["documents"], list):
            return data["documents"]
        return [data]
    else:
        raise ValueError("File JSON phải chứa một mảng (list) hoặc object chứa danh sách mục.")


def parse_csv_file(file_path: Path) -> List[Dict[str, Any]]:
    """
    Đọc dữ liệu từ file CSV.
    Cột hỗ trợ: type, level, japanese, reading, meaning_vi, examples, tags, notes
    """
    items = []
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            item: Dict[str, Any] = {}
            for k, v in row.items():
                if k:
                    item[k.strip().lower()] = v.strip() if v else ""

            # Parse tags (dấu phẩy phân tách)
            raw_tags = item.get("tags", "")
            item["tags"] = [t.strip() for t in raw_tags.split(",") if t.strip()] if raw_tags else []

            # Parse examples nếu có (phân tách bằng ;; hoặc JSON)
            raw_ex = item.get("examples", "")
            if raw_ex:
                if raw_ex.startswith("["):
                    try:
                        item["examples"] = json.loads(raw_ex)
                    except Exception:
                        item["examples"] = [raw_ex]
                else:
                    parsed_examples = []
                    parts = raw_ex.split(";;")
                    for p in parts:
                        sub = p.split("|")
                        if len(sub) >= 3:
                            parsed_examples.append({
                                "sentence_ja": sub[0].strip(),
                                "reading": sub[1].strip(),
                                "meaning_vi": sub[2].strip()
                            })
                        elif len(sub) == 2:
                            parsed_examples.append({
                                "sentence_ja": sub[0].strip(),
                                "meaning_vi": sub[1].strip()
                            })
                        elif sub[0].strip():
                            parsed_examples.append({"sentence_ja": sub[0].strip()})
                    item["examples"] = parsed_examples

            items.append(item)
    return items


def parse_markdown_file(file_path: Path) -> List[Dict[str, Any]]:
    """
    Đọc dữ liệu từ file Markdown (.md).
    Hỗ trợ khối tài liệu phân tách bằng '---' frontmatter hoặc tiêu đề '# '.
    """
    text = file_path.read_text(encoding="utf-8")
    # Tách theo các khối phân cách bởi cặp --- (frontmatter) hoặc đường kẻ ngang
    raw_blocks = re.split(r"(?:^|\n)---+\r?\n", text)
    items = []

    idx = 0
    while idx < len(raw_blocks):
        block = raw_blocks[idx].strip()
        idx += 1
        if not block:
            continue

        item: Dict[str, Any] = {
            "type": "vocabulary",
            "level": "N5",
            "tags": [],
            "examples": []
        }

        # Kiểm tra xem block này có phải metadata YAML frontmatter không
        is_meta_block = any(re.match(r"^(type|level|japanese|reading|meaning|tags|title)\s*:\s*", line, re.I) for line in block.splitlines())
        
        meta_lines = []
        body_lines = []
        if is_meta_block and idx < len(raw_blocks):
            # Block hiện tại là frontmatter, block tiếp theo là body
            meta_lines = block.splitlines()
            body_block = raw_blocks[idx].strip()
            idx += 1
            body_lines = body_block.splitlines()
        else:
            for line in block.splitlines():
                if re.match(r"^(type|level|japanese|reading|meaning|tags|title)\s*:\s*", line, re.I):
                    meta_lines.append(line)
                else:
                    body_lines.append(line)

        for line in meta_lines:
            if re.match(r"^(type|document_type)\s*:\s*", line, re.I):
                item["type"] = line.split(":", 1)[1].strip().lower()
            elif re.match(r"^(level|jlpt_level)\s*:\s*", line, re.I):
                item["level"] = line.split(":", 1)[1].strip().upper()
            elif re.match(r"^japanese\s*:\s*", line, re.I):
                item["japanese"] = line.split(":", 1)[1].strip()
            elif re.match(r"^reading\s*:\s*", line, re.I):
                item["reading"] = line.split(":", 1)[1].strip()
            elif re.match(r"^meaning(_vi)?\s*:\s*", line, re.I):
                item["meaning_vi"] = line.split(":", 1)[1].strip()
            elif re.match(r"^tags\s*:\s*", line, re.I):
                tags_str = line.split(":", 1)[1].strip()
                item["tags"] = [t.strip() for t in tags_str.split(",") if t.strip()]
            elif re.match(r"^title\s*:\s*", line, re.I):
                item["title"] = line.split(":", 1)[1].strip()

        body = "\n".join(body_lines).strip()
        if not item.get("japanese") and not item.get("title"):
            match = re.search(r"^#+\s+(.+)$", body, re.M)
            if match:
                item["title"] = match.group(1).strip()
            else:
                item["title"] = (body.splitlines()[0])[:80] if body else "Tài liệu tiếng Nhật"

        if body and not item.get("content"):
            item["content"] = body

        if item.get("japanese") or item.get("title") or item.get("content"):
            items.append(item)

    return items


def load_items(file_path: Path, format_type: Optional[str] = None) -> List[Dict[str, Any]]:
    """Tự động xác định định dạng và đọc các mục học liệu."""
    if not file_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file: {file_path}")

    ext = file_path.suffix.lower()
    fmt = (format_type or ext.lstrip(".")).lower()

    if fmt in {"json"}:
        return parse_json_file(file_path)
    elif fmt in {"csv"}:
        return parse_csv_file(file_path)
    elif fmt in {"md", "markdown"}:
        return parse_markdown_file(file_path)
    else:
        # Thử đoán JSON trước, nếu lỗi thì thử Markdown
        try:
            return parse_json_file(file_path)
        except Exception:
            return parse_markdown_file(file_path)


def upsert_knowledge_items(db, items: List[Dict[str, Any]], dry_run: bool = False) -> Dict[str, int]:
    """
    Thực hiện nạp và lập chỉ mục từng mục học liệu vào PostgreSQL và Vector Database.
    """
    from app.models.database import Document
    from app.services.library_service import library_service
    from app.services.vector_db import chroma_service

    stats = {"total": len(items), "created": 0, "updated": 0, "skipped": 0, "errors": 0}

    for idx, raw_item in enumerate(items, 1):
        try:
            doc_type = (raw_item.get("type") or raw_item.get("document_type") or "vocabulary").strip().lower()
            if doc_type not in ALLOWED_TYPES:
                doc_type = "vocabulary"

            level = (raw_item.get("level") or raw_item.get("jlpt_level") or "").strip().upper()
            if level and level not in JLPT_LEVELS:
                level = None

            title, content = format_item_content(raw_item)
            if not title or not content:
                stats["skipped"] += 1
                continue

            raw_tags = raw_item.get("tags") or []
            if isinstance(raw_tags, str):
                raw_tags = [t.strip() for t in raw_tags.split(",") if t.strip()]
            tags = list({doc_type, level or "all", *raw_tags})
            tags = [t for t in tags if t]

            if dry_run:
                print(f"[DRY-RUN {idx}/{len(items)}] [{doc_type.upper()}|{level or 'ALL'}] {title}")
                stats["created"] += 1
                continue

            # Kiểm tra xem tài liệu đã có trong PostgreSQL chưa (theo title hoặc japanese)
            existing = db.query(Document).filter(Document.title == title).first()
            if not existing and raw_item.get("japanese"):
                # Thử tìm theo tiêu đề bắt đầu bằng loại và từ tiếng Nhật
                existing = db.query(Document).filter(
                    Document.title.ilike(f"%{raw_item['japanese']}%"),
                    Document.document_type == doc_type
                ).first()

            if existing is None:
                document = Document(
                    title=title,
                    content=content,
                    document_type=doc_type,
                    jlpt_level=level,
                    tags=tags,
                    source_url=raw_item.get("source_url") or None
                )
                db.add(document)
                db.commit()
                db.refresh(document)
                library_service._index_document(db, document)
                stats["created"] += 1
                print(f" [+] [Tạo mới] #{document.id}: {title}")
            else:
                existing.title = title
                existing.content = content
                existing.document_type = doc_type
                existing.jlpt_level = level
                existing.tags = tags
                if raw_item.get("source_url"):
                    existing.source_url = raw_item.get("source_url")
                db.commit()
                db.refresh(existing)
                chroma_service.delete_document(str(existing.id))
                library_service._index_document(db, existing)
                stats["updated"] += 1
                print(f" [*] [Cập nhật] #{existing.id}: {title}")

        except Exception as exc:
            db.rollback()
            stats["errors"] += 1
            print(f" [!] Lỗi mục #{idx} ({raw_item.get('japanese') or raw_item.get('title')}): {exc}")

    return stats


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Nhập dữ liệu học liệu tiếng Nhật cho SenpaiAI RAG.")
    parser.add_argument("--file", "-f", type=Path, default=Path("app/data/japanese_knowledge_seed.json"),
                        help="Đường dẫn file dữ liệu (JSON, CSV, MD)")
    parser.add_argument("--format", choices=["json", "csv", "md", "markdown"],
                        help="Ép định dạng file (nếu không đặt, tự nhận diện theo đuôi mở rộng)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Chỉ kiểm tra và in các mục, không ghi vào cơ sở dữ liệu")
    args = parser.parse_args()

    target_file = args.file
    if not target_file.exists():
        if (BACKEND_DIR / target_file).exists():
            target_file = BACKEND_DIR / target_file
        elif (CURRENT_DIR / target_file).exists():
            target_file = CURRENT_DIR / target_file

    print(f"=== SenpaiAI Knowledge Library Importer ===")
    print(f"File nguồn: {target_file}")
    print(f"Chế độ: {'DRY RUN (Kiểm tra)' if args.dry_run else 'IMPORT THẬT'}")

    items = load_items(target_file, args.format)
    print(f"Đã đọc thành công {len(items)} mục từ file.")

    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        stats = upsert_knowledge_items(db, items, dry_run=args.dry_run)
        print("\n=== KẾT QUẢ IMPORT ===")
        print(f"Tổng số mục:      {stats['total']}")
        print(f"Tạo mới thành công: {stats['created']}")
        print(f"Cập nhật thành công: {stats['updated']}")
        print(f"Bỏ qua:            {stats['skipped']}")
        print(f"Lỗi:               {stats['errors']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
