"""Bounded document extraction and public-only URL fetching."""
import http.client
import ipaddress
import re
import socket
import ssl
import time
from urllib.parse import urljoin, urlsplit

from fastapi import HTTPException

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_TEXT = 50000
MAX_PAGE_BYTES = 2 * 1024 * 1024


def error(code, status=422):
    raise HTTPException(status_code=status, detail=code)


def clean_text(value):
    lines = [re.sub(r'[^\S\n]+', ' ', line).strip() for line in value.replace('\r\n', '\n').replace('\r', '\n').split('\n')]
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()


def decode_text(data):
    for encoding in ('utf-8-sig', 'cp932'):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            pass
    error('library_encoding_invalid')


class PinnedHTTP(http.client.HTTPConnection):
    def __init__(self, host, port, ip, timeout):
        super().__init__(host, port, timeout=timeout)
        self.ip = ip

    def connect(self):
        self.sock = socket.create_connection((self.ip, self.port), self.timeout)


class PinnedHTTPS(PinnedHTTP):
    def connect(self):
        super().connect()
        self.sock = ssl.create_default_context().wrap_socket(self.sock, server_hostname=self.host)


def fetch_public(url):
    deadline = time.monotonic() + 15
    for _ in range(4):
        parsed = urlsplit(url)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
            error('library_url_invalid')
        try:
            port = parsed.port or (443 if parsed.scheme == 'https' else 80)
            if port not in (80, 443):
                error('library_url_blocked')
            addresses = socket.getaddrinfo(parsed.hostname, port, type=socket.SOCK_STREAM)
            ips = {entry[4][0] for entry in addresses}
            if not ips or any(not ipaddress.ip_address(ip).is_global for ip in ips):
                error('library_url_blocked')
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                error('library_url_timeout', 408)
            conn = (PinnedHTTPS if parsed.scheme == 'https' else PinnedHTTP)(parsed.hostname, port, sorted(ips)[0], min(5, remaining))
            try:
                path = parsed.path or '/'
                if parsed.query:
                    path += '?' + parsed.query
                conn.request('GET', path, headers={'User-Agent': 'SenpaiAI-Library/1.0', 'Accept': 'text/html,text/plain'})
                response = conn.getresponse()
                if response.status in (301, 302, 303, 307, 308):
                    target = response.getheader('Location')
                    if not target:
                        error('library_url_failed', 400)
                    url = urljoin(url, target)
                    continue
                if response.status >= 400:
                    error('library_url_failed', 400)
                content_type = response.getheader('Content-Type', '')
                if content_type and not any(kind in content_type.lower() for kind in ('text/html', 'application/xhtml+xml', 'text/plain')):
                    error('library_url_type', 415)
                chunks, size = [], 0
                while True:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        error('library_url_timeout', 408)
                    if conn.sock:
                        conn.sock.settimeout(min(5, remaining))
                    chunk = response.read1(65536)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > MAX_PAGE_BYTES:
                        error('library_page_too_large', 413)
                    chunks.append(chunk)
                charset = response.headers.get_content_charset() or 'utf-8'
                try:
                    body = b''.join(chunks).decode(charset)
                except (UnicodeDecodeError, LookupError):
                    body = decode_text(b''.join(chunks))
                return body, url
            finally:
                conn.close()
        except (socket.timeout, TimeoutError):
            error('library_url_timeout', 408)
        except (OSError, ValueError, http.client.HTTPException):
            error('library_url_failed', 400)
    error('library_url_redirects', 400)
