import logging
from typing import Optional

from fastapi import APIRouter, Depends, status
from fastapi import Query
from sqlalchemy.orm import Session

from ..core.auth import get_current_active_user
from ..core.database import get_db
from ..models.database import User
from ..models.schemas import (
    Document as DocumentSchema,
    DocumentCreate,
    DocumentFetchUrlRequest,
    DocumentFetchUrlResponse,
    DocumentListResponse,
    DocumentSearchRequest,
    DocumentUpdate,
    LibraryCategoriesResponse,
    LibrarySearchResponse,
    LibraryStatsResponse,
)
from ..services.library_service import library_service

router = APIRouter(prefix="/library", tags=["library"])
api_router = APIRouter(prefix="/api/library", tags=["library"])
logger = logging.getLogger(__name__)


def _current_user_dependency(current_user: User = Depends(get_current_active_user)) -> User:
    return current_user


@router.get("/quiz")
async def get_library_quiz(
    mode: str = Query(default="vocabulary_matching_grid", pattern="^vocabulary_matching_grid$"),
    jlpt: str = Query(default="all", pattern="^(N5|N4|N3|N2|N1|all|ALL|n5|n4|n3|n2|n1)$"),
    count: int = Query(default=6, ge=2, le=12),
    db: Session = Depends(get_db),
):
    """Return library vocabulary pairs for card matching minigames."""
    del mode
    return {"pairs": library_service.vocabulary_matching_pairs(db, jlpt_level=jlpt, count=count)}


@api_router.post("/fetch-url", response_model=DocumentFetchUrlResponse)
async def fetch_document_url(
    payload: DocumentFetchUrlRequest,
    current_user: User = Depends(_current_user_dependency),
):
    """Fetch a URL and return readable text for the Add Document form."""
    del current_user
    return library_service.fetch_url_content(payload.url)


@router.get("/documents", response_model=DocumentListResponse)
@api_router.get("/documents", response_model=DocumentListResponse)
async def get_documents(
    document_type: Optional[str] = None,
    jlpt_level: Optional[str] = None,
    tag: Optional[str] = None,
    sort: str = "newest",
    limit: int = 24,
    offset: int = 0,
    current_user: User = Depends(_current_user_dependency),
    db: Session = Depends(get_db),
):
    """List PostgreSQL documents with filters, sorting, and pagination."""
    try:
        documents, total = library_service.list_documents(
            db,
            document_type=document_type,
            jlpt_level=jlpt_level,
            tag=tag,
            sort=sort,
            limit=limit,
            offset=offset,
        )
    except Exception as exc:
        logger.exception("[Library] failed to load documents: %s", exc)
        documents, total = [], 0
    return DocumentListResponse(items=documents, total=total, limit=limit, offset=offset)


@router.get("/documents/{document_id}", response_model=DocumentSchema)
@api_router.get("/documents/{document_id}", response_model=DocumentSchema)
async def get_document(
    document_id: int,
    current_user: User = Depends(_current_user_dependency),
    db: Session = Depends(get_db),
):
    """Get one document from PostgreSQL."""
    return library_service.get_document(db, document_id)


@router.post("/documents", response_model=DocumentSchema, status_code=status.HTTP_201_CREATED)
@api_router.post("/documents", response_model=DocumentSchema, status_code=status.HTTP_201_CREATED)
async def create_document(
    payload: DocumentCreate,
    current_user: User = Depends(_current_user_dependency),
    db: Session = Depends(get_db),
):
    """Create a document, then chunk and index it in ChromaDB."""
    return library_service.create_document(db, payload)


@router.put("/documents/{document_id}", response_model=DocumentSchema)
@api_router.put("/documents/{document_id}", response_model=DocumentSchema)
async def update_document(
    document_id: int,
    payload: DocumentUpdate,
    current_user: User = Depends(_current_user_dependency),
    db: Session = Depends(get_db),
):
    """Update PostgreSQL document data and refresh ChromaDB chunks."""
    return library_service.update_document(db, document_id, payload)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
@api_router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    current_user: User = Depends(_current_user_dependency),
    db: Session = Depends(get_db),
):
    """Delete a document and all ChromaDB chunks."""
    library_service.delete_document(db, document_id)
    return None


@router.post("/search", response_model=LibrarySearchResponse)
@api_router.post("/search", response_model=LibrarySearchResponse)
async def search_documents(
    request: DocumentSearchRequest,
    current_user: User = Depends(_current_user_dependency),
    db: Session = Depends(get_db),
):
    """Semantic document search backed by ChromaDB, with keyword fallback."""
    results = library_service.search_documents(
        db,
        query=request.query,
        document_type=request.document_type,
        jlpt_level=request.jlpt_level,
        limit=request.limit,
        offset=request.offset,
    )
    return LibrarySearchResponse(results=results)


@router.get("/categories", response_model=LibraryCategoriesResponse)
@api_router.get("/categories", response_model=LibraryCategoriesResponse)
async def get_document_categories(
    current_user: User = Depends(_current_user_dependency),
    db: Session = Depends(get_db),
):
    """Return dynamic document type and JLPT filter values."""
    return library_service.categories(db)


@router.get("/stats", response_model=LibraryStatsResponse)
@api_router.get("/stats", response_model=LibraryStatsResponse)
async def get_library_stats(
    current_user: User = Depends(_current_user_dependency),
    db: Session = Depends(get_db),
):
    """Return dashboard stats from PostgreSQL and ChromaDB."""
    try:
        return library_service.stats(db)
    except Exception as exc:
        logger.exception("[Library] failed to load stats: %s", exc)
        return library_service.empty_stats()
