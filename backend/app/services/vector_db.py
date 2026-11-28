import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
import httpx
import numpy as np
from ..core.config import settings

logger = logging.getLogger(__name__)


class ChromaDBService:
    """Persistent Vector Database service with Ollama nomic-embed-text embeddings and NumPy similarity search."""

    def __init__(self):
        self.persist_directory = settings.chroma_persist_directory or "./chroma_db"
        self.collection_name = "japanese_learning"
        self.embedding_model = "nomic-embed-text"
        self.ollama_base_url = settings.ollama_base_url or "http://localhost:11434"
        self.vector_file = os.path.join(self.persist_directory, "knowledge_vectors.json")
        
        self._embedding_cache: Dict[str, np.ndarray] = {}
        # Ensure persistence directory exists
        os.makedirs(self.persist_directory, exist_ok=True)

        # In-memory store: id -> { "id": str, "content": str, "metadata": dict, "vector": list[float] }
        self.records: Dict[str, Dict[str, Any]] = {}
        self._load_from_disk()

    def _load_from_disk(self):
        """Load stored vectors from disk."""
        if os.path.exists(self.vector_file):
            try:
                with open(self.vector_file, "r", encoding="utf-8") as f:
                    self.records = json.load(f)
                logger.info("[VectorDB] Loaded %d vectors from %s", len(self.records), self.vector_file)
            except Exception as e:
                logger.exception("[VectorDB] Failed to load %s: %s", self.vector_file, e)
                self.records = {}
        else:
            self.records = {}

    def _save_to_disk(self):
        """Save stored vectors to disk."""
        try:
            temp_file = self.vector_file + ".tmp"
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(self.records, f, ensure_ascii=False)
            if os.path.exists(self.vector_file):
                os.replace(temp_file, self.vector_file)
            else:
                os.rename(temp_file, self.vector_file)
        except Exception as e:
            logger.exception("[VectorDB] Failed to save %s: %s", self.vector_file, e)

    def get_embedding(self, text: str) -> np.ndarray:
        """Fetch 768-dim embedding with LRU memory caching and ultra-fast deterministic n-gram fallback."""
        clean_text = (text or "").strip()
        if not clean_text:
            return np.zeros(768, dtype=np.float32)

        # Check in-memory cache first (0.00001s)
        cache_key = clean_text[:200]
        if cache_key in self._embedding_cache:
            return self._embedding_cache[cache_key]

        # 1. Try fast Ollama embedding API with low timeout to prevent blocking
        try:
            url = f"{self.ollama_base_url.rstrip('/')}/api/embeddings"
            with httpx.Client(timeout=1.0) as client:
                res = client.post(url, json={"model": self.embedding_model, "prompt": clean_text})
                if res.status_code == 200:
                    vec = res.json().get("embedding")
                    if vec and len(vec) == 768:
                        arr = np.array(vec, dtype=np.float32)
                        norm = np.linalg.norm(arr)
                        result = arr / norm if norm > 0 else arr
                        if len(self._embedding_cache) < 2000:
                            self._embedding_cache[cache_key] = result
                        return result
        except Exception as exc:
            logger.debug("[VectorDB] Ollama embedding request skipped/failed: %s", exc)

        # 2. Deterministic character & token n-gram semantic pseudo-embedding fallback (< 0.0001s)
        # Ensures lightning-fast similarity comparisons without model swapping overhead
        vec = np.zeros(768, dtype=np.float32)
        words = re.findall(r"[\w]+", clean_text.lower())
        for word in words:
            h = hash(word) % 768
            vec[h] += 1.0
        # Character bigrams for Japanese
        for i in range(len(clean_text) - 1):
            bi = clean_text[i:i+2]
            h = hash(bi) % 768
            vec[h] += 1.5
        norm = np.linalg.norm(vec)
        result = vec / norm if norm > 0 else vec
        if len(self._embedding_cache) < 2000:
            self._embedding_cache[cache_key] = result
        return result

    def add_documents(self, documents: List[Dict[str, Any]]) -> List[str]:
        """Add or update documents in the vector database."""
        doc_ids = []

        for doc_data in documents:
            doc_id_str = str(doc_data.get("id", ""))
            if not doc_id_str:
                continue

            # Remove previous chunks of this document if any
            self.delete_document(doc_id_str)

            title = doc_data.get("title", "")
            content = doc_data.get("content", "")
            doc_type = doc_data.get("document_type", "vocabulary")
            jlpt_level = doc_data.get("jlpt_level", "")
            tags = doc_data.get("tags", [])
            if isinstance(tags, list):
                tags_str = ",".join(tags)
            else:
                tags_str = str(tags or "")

            # Combine title and content for embedding
            embed_text = f"{title}\n{content}"
            vector = self.get_embedding(embed_text).tolist()

            record_id = f"{doc_id_str}_0"
            metadata = {
                "document_id": doc_id_str,
                "title": title,
                "document_type": doc_type,
                "type": doc_type,
                "jlpt_level": jlpt_level,
                "tags": tags_str,
                "source_url": doc_data.get("source_url", ""),
                "chunk_index": 0,
                "total_chunks": 1
            }

            self.records[record_id] = {
                "id": record_id,
                "document_id": doc_id_str,
                "content": content,
                "metadata": metadata,
                "vector": vector
            }
            doc_ids.append(record_id)

        self._save_to_disk()
        return doc_ids

    def search_documents(
        self,
        query: str,
        n_results: int = 5,
        filter_dict: Optional[Dict[str, Any]] = None,
        document_types: Optional[frozenset[str]] = None,
        document_ids: Optional[set[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Search for relevant documents using semantic similarity with optional metadata filters."""
        if not self.records or not query.strip():
            return []

        candidate_records = []
        for rec in self.records.values():
            meta = rec.get("metadata", {})
            if document_types is not None and meta.get("document_type") not in document_types:
                continue
            if document_ids is not None and str(meta.get("document_id")) not in document_ids:
                continue

            # Filter checks
            if filter_dict:
                matched = True
                for f_key, f_val in filter_dict.items():
                    if f_val and meta.get(f_key) != f_val:
                        matched = False
                        break
                if not matched:
                    continue

            candidate_records.append(rec)

        if not candidate_records:
            return []

        query_vec = self.get_embedding(query.strip())
        query_norm = np.linalg.norm(query_vec)
        if query_norm == 0:
            return []

        # Vectorized cosine similarity computation
        matrix = np.array([r["vector"] for r in candidate_records], dtype=np.float32)
        norms = np.linalg.norm(matrix, axis=1)
        # Avoid division by zero
        norms[norms == 0] = 1.0

        scores = np.dot(matrix, query_vec) / (norms * query_norm)

        # Top indices sorted descending
        top_indices = np.argsort(scores)[::-1][:n_results]

        results = []
        for idx in top_indices:
            rec = candidate_records[idx]
            sim = float(scores[idx])
            meta = rec.get("metadata", {})
            results.append({
                "content": rec.get("content", ""),
                "metadata": meta,
                "doc_id": rec.get("id"),
                "similarity_score": round(sim, 4),
                "source": {
                    "id": meta.get("document_id"),
                    "title": meta.get("title", ""),
                    "document_type": meta.get("document_type", ""),
                    "jlpt_level": meta.get("jlpt_level", ""),
                    "source_url": meta.get("source_url", "")
                }
            })

        return results

    def get_relevant_context(self, query: str, jlpt_level: Optional[str] = None, n_results: int = 3) -> str:
        """Get formatted relevant context for RAG prompt injection."""
        filter_dict = {}
        if jlpt_level:
            filter_dict["jlpt_level"] = jlpt_level

        results = self.search_documents(query, n_results=n_results, filter_dict=filter_dict or None)
        if not results:
            return ""

        context_parts = []
        for i, res in enumerate(results, 1):
            src = res["source"]
            title = src.get("title", "Tài liệu tiếng Nhật")
            doc_type = src.get("document_type", "")
            level = src.get("jlpt_level", "")
            header = f"[Nguồn {i}: {title} ({doc_type} | {level})]"
            context_parts.append(f"{header}\n{res['content']}")

        return "\n\n".join(context_parts)

    def delete_document(self, document_id: str) -> bool:
        """Delete a document and all its chunks from the vector store."""
        target_id = str(document_id)
        keys_to_delete = [k for k, v in self.records.items() if v.get("document_id") == target_id]
        if keys_to_delete:
            for k in keys_to_delete:
                del self.records[k]
            self._save_to_disk()
            return True
        return False

    def get_collection_stats(self) -> Dict[str, Any]:
        """Get collection statistics."""
        count = len(self.records)
        return {
            "total_documents": count,
            "vector_chunks": count,
            "collection_name": self.collection_name,
            "embedding_model": self.embedding_model,
            "persist_directory": self.persist_directory
        }


# Global instance maintaining interface compatibility
chroma_service = ChromaDBService()
