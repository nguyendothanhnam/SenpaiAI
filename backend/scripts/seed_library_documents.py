#!/usr/bin/env python3
"""
Nạp bộ tài liệu mẫu (thư viện hệ thống dùng chung) vào Thư viện.

- Đọc backend/scripts/data/library_documents.json.
- Chạy lại nhiều lần không bị trùng: tài liệu được nhận diện theo tiêu đề.
  Tài liệu chưa có thì tạo mới, đã có và nội dung đổi thì cập nhật + lập chỉ mục lại,
  không đổi thì bỏ qua.
- Tài liệu hệ thống = không có chủ sở hữu (documents.owner_id để trống nếu cột này đã có).
  Script KHÔNG đụng tới tài liệu cá nhân của người dùng.

Cách chạy (từ thư mục backend, hoặc trong container backend):
    python scripts/seed_library_documents.py --dry-run     # chỉ kiểm tra file dữ liệu
    python scripts/seed_library_documents.py               # nạp thật
    python scripts/seed_library_documents.py --file đường/dẫn/khác.json
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

ALLOWED_TYPES = {"vocabulary", "grammar", "lesson", "culture", "example"}
JLPT_LEVELS = {"N5", "N4", "N3", "N2", "N1"}
MAX_CONTENT_CHARS = 100_000
DEFAULT_FILE = Path(__file__).resolve().parent / "data" / "library_documents.json"


def load_documents(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError("File dữ liệu phải là một danh sách (JSON array) các tài liệu.")
    return data


def validate_documents(docs: list[dict]) -> list[str]:
    """Trả về danh sách lỗi (rỗng nếu hợp lệ)."""
    errors: list[str] = []
    seen: set[str] = set()
    for index, doc in enumerate(docs, start=1):
        label = f"#{index} {doc.get('title', '(không có tiêu đề)')!r}"
        title = (doc.get("title") or "").strip()
        content = (doc.get("content") or "").strip()
        if not title:
            errors.append(f"{label}: thiếu title")
        if title in seen:
            errors.append(f"{label}: trùng tiêu đề trong file")
        seen.add(title)
        if not content:
            errors.append(f"{label}: thiếu content")
        if len(content) > MAX_CONTENT_CHARS:
            errors.append(f"{label}: content quá dài (> {MAX_CONTENT_CHARS} ký tự)")
        if doc.get("document_type") not in ALLOWED_TYPES:
            errors.append(f"{label}: document_type không hợp lệ ({doc.get('document_type')!r})")
        level = doc.get("jlpt_level")
        if level and level not in JLPT_LEVELS:
            errors.append(f"{label}: jlpt_level không hợp lệ ({level!r})")
        tags = doc.get("tags", [])
        if not isinstance(tags, list) or any(not isinstance(tag, str) for tag in tags):
            errors.append(f"{label}: tags phải là danh sách chuỗi")
        if re.search(r"(\*\*|^#{1,6} |```)", content, re.M):
            errors.append(f"{label}: content có ký hiệu Markdown (giao diện hiển thị văn bản thuần)")
    return errors


def normalize_tags(tags: list[str]) -> list[str]:
    result: list[str] = []
    for tag in tags or []:
        cleaned = tag.strip()
        if cleaned and cleaned not in result:
            result.append(cleaned)
    return result


def upsert_documents(db, model, docs, index_fn, delete_vectors_fn):
    """
    Tạo/cập nhật tài liệu hệ thống. Tách riêng để dễ kiểm thử.
    - model: lớp Document (SQLAlchemy)
    - index_fn(db, document): lập chỉ mục vector, trả về cảnh báo (str) hoặc None
    - delete_vectors_fn(document_id): xóa vector cũ trước khi lập chỉ mục lại
    """
    stats = {"created": 0, "updated": 0, "unchanged": 0, "index_warnings": 0}
    has_owner = hasattr(model, "owner_id")

    for doc in docs:
        title = doc["title"].strip()
        values = {
            "content": doc["content"].strip(),
            "document_type": doc["document_type"].strip(),
            "jlpt_level": doc.get("jlpt_level") or None,
            "tags": normalize_tags(doc.get("tags", [])),
            "source_url": (doc.get("source_url") or None),
        }

        query = db.query(model).filter(model.title == title)
        if has_owner:
            query = query.filter(model.owner_id.is_(None))  # chỉ tài liệu hệ thống
        existing = query.first()

        if existing is None:
            document = model(title=title, **values)
            db.add(document)
            db.commit()
            db.refresh(document)
            warning = index_fn(db, document)
            stats["created"] += 1
        else:
            changed = any(getattr(existing, key) != value for key, value in values.items())
            if not changed:
                stats["unchanged"] += 1
                continue
            for key, value in values.items():
                setattr(existing, key, value)
            db.commit()
            db.refresh(existing)
            delete_vectors_fn(existing.id)  # tránh để sót đoạn cũ khi nội dung ngắn lại
            warning = index_fn(db, existing)
            stats["updated"] += 1

        if warning:
            stats["index_warnings"] += 1
            print(f"  ! Cảnh báo lập chỉ mục cho {title!r}: {warning}")

    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="Nạp tài liệu mẫu vào thư viện hệ thống.")
    parser.add_argument("--file", type=Path, default=DEFAULT_FILE, help="đường dẫn file JSON")
    parser.add_argument("--dry-run", action="store_true", help="chỉ kiểm tra dữ liệu, không ghi gì")
    args = parser.parse_args()

    docs = load_documents(args.file)
    errors = validate_documents(docs)
    if errors:
        print("Dữ liệu không hợp lệ:")
        for error in errors:
            print(f"  - {error}")
        return 1
    print(f"Đã đọc {len(docs)} tài liệu hợp lệ từ {args.file}")

    if args.dry_run:
        print("Chế độ --dry-run: không ghi vào cơ sở dữ liệu.")
        return 0

    # Chỉ nạp ứng dụng khi thật sự ghi dữ liệu
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from app.core.database import SessionLocal
    from app.models.database import Document
    from app.services.library_service import library_service
    from app.services.vector_db import chroma_service

    db = SessionLocal()
    try:
        stats = upsert_documents(
            db,
            Document,
            docs,
            index_fn=library_service._index_document,
            delete_vectors_fn=lambda document_id: chroma_service.delete_document(str(document_id)),
        )
    finally:
        db.close()

    print(
        "Hoàn tất: "
        f"tạo mới {stats['created']}, cập nhật {stats['updated']}, "
        f"không đổi {stats['unchanged']}, cảnh báo chỉ mục {stats['index_warnings']}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
