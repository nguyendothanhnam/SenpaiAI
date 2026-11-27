import socket
from io import BytesIO

import pytest
from fastapi import HTTPException
from pypdf import PdfWriter

from app.services.library_extract import clean_text, decode_text, fetch_public
from app.services.library_service import library_service


def test_encodings_and_paragraphs():
    assert decode_text('日本語 tiếng Việt'.encode('utf-8')) == '日本語 tiếng Việt'
    assert decode_text('日本語'.encode('cp932')) == '日本語'
    assert clean_text('  日本語  \r\n\r\n  tiếng   Việt ') == '日本語\n\ntiếng Việt'
    with pytest.raises(HTTPException) as exc:
        decode_text(b'\x81')
    assert exc.value.detail == 'library_encoding_invalid'


def test_scanned_pdf_and_long_text():
    writer = PdfWriter(); writer.add_blank_page(width=100, height=100)
    output = BytesIO(); writer.write(output)
    with pytest.raises(HTTPException) as exc:
        library_service.extract_file_content('scan.pdf', output.getvalue())
    assert exc.value.detail == 'library_pdf_scanned'
    with pytest.raises(HTTPException) as exc:
        library_service.extract_file_content('long.txt', b'a' * 50001)
    assert exc.value.detail == 'library_content_too_long'


def test_word_and_text_extraction():
    import docx
    document = docx.Document(); document.add_paragraph('日本語 và tiếng Việt')
    output = BytesIO(); document.save(output)
    assert '日本語 và tiếng Việt' in library_service.extract_file_content('test.docx', output.getvalue())[1]
    assert library_service.extract_file_content('test.txt', '日本語'.encode('cp932'))[1] == '日本語'
    with pytest.raises(HTTPException) as exc:
        library_service.extract_file_content('test.doc', b'not a word document')
    assert exc.value.detail == 'library_word_invalid'


def test_html_strips_navigation_and_keeps_paragraphs():
    title, text = library_service._extract_readable_text('<title>Test</title><nav>MENU</nav><article><p>日本語です。</p><p>Tiếng Việt.</p></article><aside>ADS</aside>', 'https://example.org')
    assert title == 'Test'
    assert 'MENU' not in text and 'ADS' not in text
    assert '日本語です。\nTiếng Việt.' in text


def test_private_addresses_and_redirect_target_rejected(monkeypatch):
    monkeypatch.setattr(socket, 'getaddrinfo', lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 80))])
    with pytest.raises(HTTPException) as exc:
        fetch_public('http://example.test/')
    assert exc.value.detail == 'library_url_blocked'
