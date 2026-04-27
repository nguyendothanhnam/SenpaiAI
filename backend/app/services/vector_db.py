import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import List, Dict, Any, Optional
import os
from ..core.config import settings

# Disable ChromaDB telemetry before importing
os.environ.setdefault('ANONYMIZED_TELEMETRY', 'False')
os.environ.setdefault('CHROMA_TELEMETRY_DISABLED', 'True')


class ChromaDBService:
    def __init__(self):
        self.persist_directory = settings.chroma_persist_directory
        self.collection_name = "japanese_learning"

        # Initialize ChromaDB client with telemetry disabled
        try:
            self.client = chromadb.PersistentClient(
                path=self.persist_directory,
                settings=ChromaSettings(
                    anonymized_telemetry=False,
                    allow_reset=True,
                    is_persistent=True
                )
            )
        except Exception as e:
            # Fallback if settings cause issues
            print(f"Warning: ChromaDB settings error: {e}, using default settings")
            self.client = chromadb.PersistentClient(
                path=self.persist_directory
            )

        # Embeddings will be handled by ChromaDB directly
        # For Ollama, we'll use ChromaDB's default embedding function
        self.embeddings = None

        # Initialize text splitter
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )

        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}
        )

        # ChromaDB collection is ready to use

    def add_documents(self, documents: List[Dict[str, Any]]) -> List[str]:
        """Add documents to the vector database."""
        doc_ids = []

        for doc_data in documents:
            # Split document into chunks
            chunks = self.text_splitter.split_text(doc_data["content"])

            for i, chunk in enumerate(chunks):
                doc_id = f"{doc_data['id']}_{i}"

                # Create document metadata
                metadata = {
                    "document_id": str(doc_data["id"]),  # Store document ID for easy retrieval
                    "title": doc_data["title"],
                    "document_type": doc_data["document_type"],
                    "jlpt_level": doc_data.get("jlpt_level", ""),
                    "tags": ",".join(doc_data.get("tags", [])),
                    "source_url": doc_data.get("source_url", ""),
                    "chunk_index": i,
                    "total_chunks": len(chunks)
                }

                # Add to ChromaDB
                self.collection.add(
                    documents=[chunk],
                    metadatas=[metadata],
                    ids=[doc_id]
                )

                doc_ids.append(doc_id)

        return doc_ids

    def search_documents(
            self,
            query: str,
            n_results: int = 5,
            filter_dict: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Search for relevant documents using semantic similarity."""

        # Perform similarity search
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results,
            where=filter_dict
        )

        # Format results
        formatted_results = []
        if results["documents"] and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                metadata = results["metadatas"][0][i]
                doc_id = results["ids"][0][i] if results["ids"] and results["ids"][0] else None
                distance = results["distances"][0][i] if results["distances"] else 0

                formatted_results.append({
                    "content": doc,
                    "metadata": metadata,
                    "doc_id": doc_id,  # Include ChromaDB document ID
                    "similarity_score": 1 - distance,  # Convert distance to similarity
                    "source": {
                        "title": metadata.get("title", ""),
                        "document_type": metadata.get("document_type", ""),
                        "jlpt_level": metadata.get("jlpt_level", ""),
                        "source_url": metadata.get("source_url", "")
                    }
                })

        return formatted_results

    def get_relevant_context(self, query: str, jlpt_level: Optional[str] = None) -> str:
        """Get relevant context for RAG using the query."""
        filter_dict = {}
        if jlpt_level:
            filter_dict["jlpt_level"] = jlpt_level

        results = self.search_documents(query, n_results=3, filter_dict=filter_dict)

        context_parts = []
        for result in results:
            context_parts.append(f"Source: {result['source']['title']}\n{result['content']}")

        return "\n\n".join(context_parts)

    def delete_document(self, document_id: str) -> bool:
        """Delete a document and all its chunks from the vector database."""
        try:
            # Find all chunks for this document
            results = self.collection.get(where={"title": {"$contains": document_id}})

            if results["ids"]:
                self.collection.delete(ids=results["ids"])
                return True
            return False
        except Exception as e:
            print(f"Error deleting document {document_id}: {e}")
            return False

    def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics about the collection."""
        try:
            count = self.collection.count()
            return {
                "total_documents": count,
                "collection_name": self.collection_name,
                "persist_directory": self.persist_directory
            }
        except Exception as e:
            return {"error": str(e)}


# Global instance
chroma_service = ChromaDBService()