"""Validate official embed URLs and parse user-supplied subtitles, never fetch media."""
import html
import re
from urllib.parse import parse_qs, urlsplit

MAX_SUBTITLE_BYTES = 1024 * 1024
MAX_SEGMENTS = 50
MAX_TIMESTAMP_MS = 12 * 60 * 60 * 1000
TIMING = re.compile(r'^(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})(?:\s+[^\r\n]*)?$')
SHORT_TIMING = re.compile(r'^(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2})\.(\d{3})(?:\s+[^\r\n]*)?$')


def video_url(raw):
    if not isinstance(raw, str) or len(raw) > 500 or raw != raw.strip():
        raise ValueError('video_invalid_url')
    try:
        parsed = urlsplit(raw)
        if parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port not in (None, 443):
            raise ValueError('video_invalid_url')
        host = (parsed.hostname or '').lower()
        if host in ('youtube.com', 'www.youtube.com', 'm.youtube.com') and parsed.path == '/watch':
            values = parse_qs(parsed.query).get('v', [])
            key = values[0] if len(values) == 1 else ''
        elif host == 'youtu.be':
            key = parsed.path.lstrip('/') if parsed.path.count('/') == 1 else ''
        elif host in ('youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com') and parsed.path.startswith('/embed/'):
            key = parsed.path[len('/embed/'):]
        else:
            key = ''
        if not re.fullmatch(r'[A-Za-z0-9_-]{11}', key):
            raise ValueError('video_invalid_url')
        return {'provider': 'youtube', 'video_id': key, 'url': f'https://www.youtube.com/watch?v={key}'}
    except ValueError:
        raise ValueError('video_invalid_url') from None


def _milliseconds(parts):
    hours, minutes, seconds, milliseconds = map(int, parts)
    if minutes >= 60 or seconds >= 60:
        raise ValueError('subtitle_invalid_time')
    value = ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds
    if value > MAX_TIMESTAMP_MS:
        raise ValueError('subtitle_invalid_time')
    return value


def validate_segments(segments):
    if not 1 <= len(segments) <= MAX_SEGMENTS:
        raise ValueError('subtitle_segment_limit')
    end = 0
    for row in segments:
        if not isinstance(row.get('start_ms'), int) or not isinstance(row.get('end_ms'), int):
            raise ValueError('subtitle_invalid_time')
        if row['start_ms'] < end or row['end_ms'] <= row['start_ms'] or row['end_ms'] > MAX_TIMESTAMP_MS:
            raise ValueError('subtitle_invalid_time')
        if not isinstance(row.get('ja'), str) or not 1 <= len(row['ja'].strip()) <= 1000:
            raise ValueError('subtitle_invalid_text')
        if not isinstance(row.get('vi', ''), str) or len(row.get('vi', '')) > 1000:
            raise ValueError('subtitle_invalid_text')
        end = row['end_ms']


def parse_subtitles(text):
    if not isinstance(text, str) or len(text.encode('utf-8')) > MAX_SUBTITLE_BYTES:
        raise ValueError('subtitle_too_large')
    text = text.lstrip('\ufeff').replace('\r\n', '\n').replace('\r', '\n').strip()
    if text.startswith('WEBVTT'):
        text = re.sub(r'^WEBVTT[^\n]*(?:\n|$)', '', text, count=1).lstrip('\n')
    rows = []
    for block in re.split(r'\n\s*\n', text):
        lines = block.split('\n')
        if not lines or not block.strip():
            continue
        if lines[0].startswith(('NOTE', 'STYLE', 'REGION')):
            continue
        if '-->' not in lines[0]:
            lines = lines[1:]
        match = TIMING.fullmatch(lines[0].strip()) if lines else None
        short = SHORT_TIMING.fullmatch(lines[0].strip()) if lines and not match else None
        if (not match and not short) or len(lines) < 2:
            raise ValueError('subtitle_invalid_format')
        if match:
            start = _milliseconds(match.groups()[:4]); end = _milliseconds(match.groups()[4:])
        else:
            groups = short.groups()
            start = _milliseconds(('0', *groups[:3])); end = _milliseconds(('0', *groups[3:]))
        caption = html.unescape(re.sub(r'<[^>]*>', '', '\n'.join(lines[1:]))).strip()
        rows.append({'start_ms': start, 'end_ms': end, 'ja': caption, 'vi': ''})
        if len(rows) > MAX_SEGMENTS:
            raise ValueError('subtitle_segment_limit')
    validate_segments(rows)
    return rows
