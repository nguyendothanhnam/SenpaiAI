"""Regression checks for damaged seed text and language-specific library views."""
import json
from dataclasses import dataclass, replace

from app.services.library_localization import DATA_DIRECTORY, catalog, localize_document, matching_sources


@dataclass
class DocumentView:
    title: str
    content: str
    tags: list
    id: int = 7
    content_preview: str = "old preview"

    def model_copy(self, *, update):
        return replace(self, **update)


def test_all_builtin_documents_have_complete_english_views():
    sources = json.loads((DATA_DIRECTORY / 'library_documents.json').read_text(encoding='utf-8'))
    for source in sources:
        original = DocumentView(source['title'], source['content'], source['tags'])
        result = localize_document(original, 'en')
        assert result.id == original.id
        assert result.title != original.title
        assert result.content != original.content
        assert result.content_preview == ' '.join(result.content.split())[:150]
        assert localize_document(original, 'vi').content == source['content']
        assert original.content == source['content']
        assert '??' not in result.content


def test_damaged_n3_documents_are_repaired_without_database_writes():
    for title, (source, _) in catalog().items():
        if not source.get('legacy_contents'):
            continue
        original = DocumentView(title, source['legacy_contents'][0], ['N3'])
        repaired = localize_document(original, 'vi')
        assert repaired.title == source['title']
        assert '?' not in repaired.content
        assert '??' in original.content
        assert '?' not in localize_document(original, 'en').title


def test_custom_content_and_original_editing_view_are_preserved():
    title = next(iter(catalog()))
    custom = DocumentView(title, 'My own notes: は and が', ['personal'])
    assert localize_document(custom, 'en') is custom
    unknown = DocumentView('Unrelated document', 'Custom text', [])
    assert localize_document(unknown, 'en') is unknown
    source, _ = catalog()[title]
    original = DocumentView(title, source['content'], source['tags'])
    assert localize_document(original, None) is original


def test_english_search_matches_translated_titles_and_content():
    matches = matching_sources('PREPARING FOR A COMPANY MEETING', 'en')
    assert len(matches) == 2  # current title and the known damaged title
    for title, contents in matches:
        source, _ = catalog()[title]
        assert source['title'].startswith('[N3]')
        assert source['content'] in contents
    assert matching_sources('no matching library phrase 83719', 'en') == []
