"""Reviewed, offline translations of the built-in library materials.

Only exact source versions are replaced. User edits and unrelated documents
keep their original content; localization never writes to the database.
"""
import json
from functools import lru_cache
from pathlib import Path

DATA_DIRECTORY = Path(__file__).resolve().parents[2] / "scripts" / "data"


@lru_cache(maxsize=1)
def catalog():
    sources = json.loads((DATA_DIRECTORY / "library_documents.json").read_text(encoding="utf-8"))
    translations = {
        item["source_title"]: item
        for item in json.loads((DATA_DIRECTORY / "library_documents.en.json").read_text(encoding="utf-8"))
    }
    entries = {}
    for source in sources:
        for title in [source["title"], *source.get("legacy_titles", [])]:
            entries[title] = (source, translations[source["title"]])
    return entries


def localize_document(document, language):
    """Return a localized schema copy, retaining IDs and all document metadata."""
    entry = catalog().get(document.title)
    if language not in {"vi", "en"} or not entry:
        return document
    source, english = entry
    if document.content not in [source["content"], *source.get("legacy_contents", [])]:
        return document
    localized = english if language == "en" else source
    updates = {key: localized[key] for key in ("title", "content", "tags")}
    if hasattr(document, "content_preview"):
        updates["content_preview"] = " ".join(localized["content"].split())[:150]
    return document.model_copy(update=updates)


def matching_sources(query, language):
    """Source versions matching words in the visible, translated material."""
    needle = query.strip().casefold()
    if not needle or language not in {"vi", "en"}:
        return []
    matches = []
    for title, (source, english) in catalog().items():
        localized = english if language == "en" else source
        searchable = " ".join([localized['title'], localized['content'], *localized['tags']])
        if needle in searchable.casefold():
            matches.append((title, [source['content'], *source.get('legacy_contents', [])]))
    return matches
