"""Shared display/search rules; never store English in the Vietnamese column."""
import unicodedata


def fold(text):
    value = unicodedata.normalize('NFKC', text or '').casefold().replace('đ', 'd')
    value = ''.join(c for c in unicodedata.normalize('NFD', value)
                    if not unicodedata.combining(c) or c in '\u3099\u309a')
    value = unicodedata.normalize('NFC', value)
    return ''.join(chr(ord(c) - 0x60) if '\u30a1' <= c <= '\u30f6' else c for c in value)


def search_text(row):
    metadata = row.source_metadata or {}
    return fold('\n'.join(str(value or '') for value in (
        row.japanese_word, row.reading, row.romaji, row.meaning, row.meaning_en,
        *metadata.get('other_forms', []), *metadata.get('other_readings', []))))


def display_meaning(row):
    # Unreviewed AI text is available in detail but never becomes a grading key.
    if row.meaning and row.meaning.strip() and row.meaning_vi_status != 'automatic':
        return row.meaning.strip()
    return '[EN] ' + row.meaning_en.strip() if row.meaning_en and row.meaning_en.strip() else ''
