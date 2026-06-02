import logging
import re
import random
from typing import Optional
from urllib.parse import urlparse

from fastapi import HTTPException, status
import requests
from bs4 import BeautifulSoup
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..models import schemas
from ..models.database import Document
from .vector_db import chroma_service


DEFAULT_TYPES = ["vocabulary", "grammar", "lesson", "culture", "example"]
JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"]
FETCH_TIMEOUT_SECONDS = 10
MAX_FETCHED_CONTENT_LENGTH = 50000
logger = logging.getLogger(__name__)


class LibraryService:
    def list_documents(
        self,
        db: Session,
        document_type: Optional[str] = None,
        jlpt_level: Optional[str] = None,
        tag: Optional[str] = None,
        limit: int = 24,
        offset: int = 0,
        sort: str = "newest",
    ) -> tuple[list[Document], int]:
        try:
            query = self._filtered_query(db, document_type, jlpt_level, tag)
            total = query.count()

            if sort == "alphabetical":
                query = query.order_by(Document.title.asc())
            else:
                query = query.order_by(Document.created_at.desc())

            return query.offset(offset).limit(limit).all(), total
        except Exception as exc:
            logger.exception("[Library] failed to load documents: %s", exc)
            return [], 0

    def get_document(self, db: Session, document_id: int) -> Document:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        return document

    def create_document(self, db: Session, payload: schemas.DocumentCreate) -> Document:
        self._validate_payload(payload.title, payload.content, payload.document_type, payload.jlpt_level)
        document = Document(
            title=payload.title.strip(),
            description=(payload.description or "").strip() or None,
            content=payload.content.strip(),
            document_type=payload.document_type.strip(),
            jlpt_level=payload.jlpt_level,
            tags=self._normalize_tags(payload.tags),
            source_url=payload.source_url,
        )
        db.add(document)
        db.commit()
        db.refresh(document)
        self._index_document(document)
        return document

    def update_document(self, db: Session, document_id: int, payload: schemas.DocumentUpdate) -> Document:
        document = self.get_document(db, document_id)
        update_data = payload.model_dump(exclude_unset=True)

        next_title = update_data.get("title", document.title)
        next_content = update_data.get("content", document.content)
        next_type = update_data.get("document_type", document.document_type)
        next_jlpt = update_data.get("jlpt_level", document.jlpt_level)
        self._validate_payload(next_title, next_content, next_type, next_jlpt)

        if "tags" in update_data and update_data["tags"] is not None:
            update_data["tags"] = self._normalize_tags(update_data["tags"])
        for key, value in update_data.items():
            if isinstance(value, str):
                value = value.strip()
            setattr(document, key, value or None if key in {"description", "source_url", "jlpt_level"} else value)

        db.commit()
        db.refresh(document)
        self._index_document(document)
        return document

    def delete_document(self, db: Session, document_id: int) -> None:
        document = self.get_document(db, document_id)
        chroma_service.delete_document(str(document_id))
        db.delete(document)
        db.commit()

    def search_documents(
        self,
        db: Session,
        query: str,
        document_type: Optional[str] = None,
        jlpt_level: Optional[str] = None,
        limit: int = 24,
        offset: int = 0,
    ) -> list[schemas.DocumentSearchResult]:
        if not query.strip():
            return []

        filter_dict = {}
        if document_type:
            filter_dict["document_type"] = document_type
        if jlpt_level:
            filter_dict["jlpt_level"] = jlpt_level

        try:
            vector_results = chroma_service.search_documents(
                query=query.strip(),
                n_results=max(limit + offset, limit),
                filter_dict=filter_dict or None,
            )
        except Exception as exc:
            logger.exception("[Library] failed to search vector database: %s", exc)
            vector_results = []

        ranked_ids: list[int] = []
        relevance_by_id: dict[int, float] = {}
        for result in vector_results:
            raw_id = result.get("metadata", {}).get("document_id")
            if not raw_id:
                continue
            document_id = int(raw_id)
            if document_id not in relevance_by_id:
                ranked_ids.append(document_id)
                relevance_by_id[document_id] = max(0.0, min(1.0, float(result.get("similarity_score", 0))))

        if not ranked_ids:
            ranked_ids = self._keyword_ids(db, query, document_type, jlpt_level, limit + offset)
            relevance_by_id = {document_id: 0.35 for document_id in ranked_ids}

        page_ids = ranked_ids[offset : offset + limit]
        documents = db.query(Document).filter(Document.id.in_(page_ids)).all() if page_ids else []
        by_id = {document.id: document for document in documents}
        items = []
        for document_id in page_ids:
            document = by_id.get(document_id)
            if not document:
                continue
            items.append(
                schemas.DocumentSearchResult(
                    id=document.id,
                    title=document.title,
                    document_type=document.document_type,
                    jlpt_level=document.jlpt_level,
                    content_preview=self._preview(document.content),
                    content=document.content,
                    tags=document.tags or [],
                    source_url=document.source_url,
                    created_at=document.created_at,
                    updated_at=document.updated_at,
                    relevance_score=round(relevance_by_id.get(document_id, 0), 4),
                )
            )

        return items

    def categories(self, db: Session) -> schemas.LibraryCategoriesResponse:
        existing_types = [
            row[0]
            for row in db.query(Document.document_type)
            .filter(Document.document_type.isnot(None))
            .distinct()
            .order_by(Document.document_type.asc())
            .all()
        ]
        jlpt_levels = [
            row[0]
            for row in db.query(Document.jlpt_level)
            .filter(Document.jlpt_level.isnot(None))
            .distinct()
            .all()
        ]
        ordered_jlpt = [level for level in JLPT_LEVELS if level in jlpt_levels]

        return schemas.LibraryCategoriesResponse(
            document_types=[doc_type for doc_type in DEFAULT_TYPES if doc_type in existing_types] or DEFAULT_TYPES,
            jlpt_levels=ordered_jlpt or JLPT_LEVELS,
        )

    def stats(self, db: Session) -> schemas.LibraryStatsResponse:
        try:
            doc_type_counts = db.query(Document.document_type, func.count(Document.id)).group_by(Document.document_type).all()
            jlpt_counts = (
                db.query(Document.jlpt_level, func.count(Document.id))
                .filter(Document.jlpt_level.isnot(None))
                .group_by(Document.jlpt_level)
                .all()
            )
            total_documents = db.query(Document).count()
        except Exception as exc:
            logger.exception("[Library] failed to load stats: %s", exc)
            return self.empty_stats()

        try:
            chroma_stats = chroma_service.get_collection_stats()
        except Exception as exc:
            logger.exception("[Library] failed to load vector stats: %s", exc)
            chroma_stats = {}

        documents_by_type = {str(key): int(count) for key, count in doc_type_counts if key}
        documents_by_jlpt = {str(key): int(count) for key, count in jlpt_counts if key}

        return schemas.LibraryStatsResponse(
            total_documents=total_documents,
            document_types=documents_by_type,
            jlpt_levels=documents_by_jlpt,
            vector_chunks=int(chroma_stats.get("vector_chunks") or chroma_stats.get("total_documents") or 0),
        )

    def empty_stats(self) -> schemas.LibraryStatsResponse:
        return schemas.LibraryStatsResponse(
            total_documents=0,
            document_types={},
            jlpt_levels={},
            vector_chunks=0,
        )

    def vocabulary_matching_pairs(self, db: Session, jlpt_level: Optional[str] = None, count: int = 6) -> list[dict]:
        from ..models.database import Vocabulary

        query = db.query(Vocabulary)
        if jlpt_level and jlpt_level.lower() != "all":
            query = query.filter(Vocabulary.jlpt_level == jlpt_level.upper())
        rows = query.limit(200).all()
        pairs = []
        for row in rows:
            word = row.japanese_word
            meaning = row.meaning
            if not word or not meaning:
                continue
            reading = row.reading or ""
            pairs.append(
                {
                    "id": word,
                    "left": word,
                    "right": f"（{reading}）{meaning}" if reading else meaning,
                    "reading": reading,
                    "meaning": meaning,
                    "jlpt": row.jlpt_level,
                }
            )
        random.shuffle(pairs)
        return pairs[: max(2, min(count, len(pairs)))]

    def fetch_url_content(self, url: str) -> dict[str, str]:
        source_url = (url or "").strip()
        parsed_url = urlparse(source_url)
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Only http:// and https:// URLs are supported")

        try:
            response = requests.get(
                source_url,
                timeout=FETCH_TIMEOUT_SECONDS,
                headers={
                    "User-Agent": "DACS-LibraryFetcher/1.0 (+https://localhost)",
                    "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.2",
                },
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            logger.warning("[Library] failed to fetch URL %s: %s", source_url, exc)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not read that URL. Check the address and try again.") from exc

        content_type = response.headers.get("content-type", "").lower()
        if content_type and "html" not in content_type and "text/plain" not in content_type:
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="URL must return a readable HTML or text page")

        title, content = self._extract_readable_text(response.text, source_url)
        if len(content) > MAX_FETCHED_CONTENT_LENGTH:
            content = content[:MAX_FETCHED_CONTENT_LENGTH].rsplit(" ", 1)[0].strip()

        if not content or len(content) < 80:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No readable page content was found at that URL")

        return {
            "title": title or parsed_url.netloc,
            "content": content,
            "source_url": source_url,
        }

    def _filtered_query(
        self,
        db: Session,
        document_type: Optional[str] = None,
        jlpt_level: Optional[str] = None,
        tag: Optional[str] = None,
    ):
        query = db.query(Document)
        if document_type:
            query = query.filter(Document.document_type == document_type)
        if jlpt_level:
            query = query.filter(Document.jlpt_level == jlpt_level)
        if tag:
            query = query.filter(Document.tags.contains([tag]))
        return query

    def _keyword_ids(
        self,
        db: Session,
        query: str,
        document_type: Optional[str],
        jlpt_level: Optional[str],
        limit: int,
    ) -> list[int]:
        pattern = f"%{query}%"
        db_query = db.query(Document.id).filter(
            or_(Document.title.ilike(pattern), Document.description.ilike(pattern), Document.content.ilike(pattern))
        )
        if document_type:
            db_query = db_query.filter(Document.document_type == document_type)
        if jlpt_level:
            db_query = db_query.filter(Document.jlpt_level == jlpt_level)
        return [row[0] for row in db_query.order_by(Document.created_at.desc()).limit(limit).all()]

    def _index_document(self, document: Document) -> None:
        try:
            chroma_service.add_documents(
                [
                    {
                        "id": document.id,
                        "title": document.title,
                        "content": document.content,
                        "document_type": document.document_type,
                        "jlpt_level": document.jlpt_level or "",
                        "tags": document.tags or [],
                        "source_url": document.source_url or "",
                    }
                ]
            )
        except Exception as exc:
            print(f"Warning: failed to index document {document.id}: {exc}")

    def _normalize_tags(self, tags: list[str] | None) -> list[str]:
        normalized = []
        for tag in tags or []:
            cleaned = tag.strip()
            if cleaned and cleaned not in normalized:
                normalized.append(cleaned)
        return normalized

    def _validate_payload(self, title: str | None, content: str | None, document_type: str | None, jlpt_level: str | None) -> None:
        if not title or not title.strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Title is required")
        if not content or not content.strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Content is required")
        if not document_type or not document_type.strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Document type is required")
        if document_type not in DEFAULT_TYPES:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid document type")
        if jlpt_level and jlpt_level not in JLPT_LEVELS:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid JLPT level")

    def _preview(self, content: str) -> str:
        compact = " ".join(content.split())
        return compact[:150]

    def _extract_readable_text(self, html: str, source_url: str) -> tuple[str, str]:
        soup = BeautifulSoup(html or "", "html.parser")
        title = ""
        if soup.title and soup.title.string:
            title = self._clean_text(soup.title.string)
        og_title = soup.find("meta", attrs={"property": "og:title"})
        if og_title and og_title.get("content"):
            title = self._clean_text(og_title["content"])

        for element in soup(["script", "style", "noscript", "iframe", "svg", "canvas", "form", "button", "input"]):
            element.decompose()
        for selector in ["nav", "header", "footer", "aside", "menu"]:
            for element in soup.find_all(selector):
                element.decompose()

        noisy_tokens = re.compile(r"(nav|menu|footer|header|sidebar|advert|ads|promo|cookie|breadcrumb|social|share|subscribe)", re.I)
        for element in soup.find_all(attrs={"class": noisy_tokens}):
            element.decompose()
        for element in soup.find_all(attrs={"id": noisy_tokens}):
            element.decompose()

        candidates = []
        for selector in ["article", "main", '[role="main"]']:
            candidates.extend(soup.select(selector))
        if not candidates:
            candidates = [soup.body or soup]

        best_text = ""
        for candidate in candidates:
            text = self._clean_text(candidate.get_text(" ", strip=True))
            if len(text) > len(best_text):
                best_text = text

        if not title:
            heading = soup.find(["h1", "h2"])
            if heading:
                title = self._clean_text(heading.get_text(" ", strip=True))

        return title, best_text

    def _clean_text(self, value: str) -> str:
        return re.sub(r"\s+", " ", value or "").strip()


library_service = LibraryService()
