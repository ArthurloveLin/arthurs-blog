from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import urljoin, urlparse

import boto3
import requests
from bs4 import BeautifulSoup


DOUBAN_BASE_URL = 'https://movie.douban.com'
DEFAULT_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': DOUBAN_BASE_URL,
    'User-Agent': os.environ.get(
        'DOUBAN_USER_AGENT',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    ),
}
IMAGE_CONTENT_TYPES = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/avif': '.avif',
}
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.avif'}
INVALID_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|]')
YEAR_PATTERN = re.compile(r'(19|20)\d{2}')


@dataclass(slots=True)
class MovieRecord:
    title: str
    subject_url: str
    poster_url: str | None = None
    year: str | None = None


def require_env(name: str) -> str:
    value = os.environ.get(name, '').strip()
    if not value:
        raise RuntimeError(f'Missing required environment variable: {name}')
    return value


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(DEFAULT_HEADERS)

    cookie = os.environ.get('DOUBAN_COOKIE', '').strip()
    if cookie:
        session.headers['Cookie'] = cookie

    return session


def build_s3_client():
    endpoint_url = os.environ.get('R2_ENDPOINT')
    if not endpoint_url:
        account_id = require_env('R2_ACCOUNT_ID')
        endpoint_url = f'https://{account_id}.r2.cloudflarestorage.com'

    return boto3.client(
        's3',
        endpoint_url=endpoint_url,
        aws_access_key_id=require_env('R2_ACCESS_KEY_ID'),
        aws_secret_access_key=require_env('R2_SECRET_ACCESS_KEY'),
        region_name='auto',
    )


def fetch_html(session: requests.Session, url: str, params: dict[str, str | int] | None = None) -> str:
    response = session.get(url, params=params, timeout=30)
    response.raise_for_status()
    return response.text


def normalize_subject_url(subject_url: str) -> str:
    return urljoin(DOUBAN_BASE_URL, subject_url)


def parse_title(item: BeautifulSoup) -> str | None:
    title_candidates = [
        item.select_one('.title em'),
        item.select_one('em'),
        item.select_one('img'),
        item.select_one('.title a'),
        item.select_one('a[href*="/subject/"]'),
    ]

    for candidate in title_candidates:
        if not candidate:
            continue

        title = candidate.get('alt') if candidate.name == 'img' else candidate.get_text(' ', strip=True)
        if title:
            return title.strip()

    return None


def parse_year(item: BeautifulSoup) -> str | None:
    year_candidates = [
        item.select_one('.intro'),
        item.select_one('.comment'),
        item,
    ]

    for candidate in year_candidates:
        text = candidate.get_text(' ', strip=True)
        match = YEAR_PATTERN.search(text)
        if match:
            return match.group(0)

    return None


def parse_collect_items(html: str) -> list[MovieRecord]:
    soup = BeautifulSoup(html, 'lxml')
    records: list[MovieRecord] = []

    for item in soup.select('.grid-view .item, .article .item'):
        subject_link = item.select_one('a[href*="/subject/"]')
        if not subject_link:
            continue

        title = parse_title(item)
        subject_url = subject_link.get('href', '').strip()
        if not title or not subject_url:
            continue

        image = item.select_one('img')
        poster_url = None
        if image:
            poster_url = image.get('src') or image.get('data-src')

        records.append(
            MovieRecord(
                title=title,
                subject_url=normalize_subject_url(subject_url),
                poster_url=poster_url,
                year=parse_year(item),
            )
        )

    return records


def iterate_watched_movies(session: requests.Session, douban_user_id: str) -> Iterable[MovieRecord]:
    start = 0
    seen_subject_urls: set[str] = set()

    while True:
        html = fetch_html(
            session,
            f'{DOUBAN_BASE_URL}/people/{douban_user_id}/collect',
            params={
                'start': start,
                'sort': 'time',
                'rating': 'all',
                'filter': 'all',
                'mode': 'grid',
            },
        )
        records = parse_collect_items(html)
        if not records:
            break

        yielded_count = 0
        for record in records:
            if record.subject_url in seen_subject_urls:
                continue

            yielded_count += 1
            seen_subject_urls.add(record.subject_url)
            yield record

        if yielded_count == 0:
            break

        start += len(records)


def fetch_subject_poster_url(session: requests.Session, subject_url: str) -> str | None:
    html = fetch_html(session, subject_url)
    soup = BeautifulSoup(html, 'lxml')

    meta_image = soup.select_one('meta[property="og:image"]')
    if meta_image and meta_image.get('content'):
        return meta_image['content'].strip()

    image = soup.select_one('#mainpic img')
    if image:
        return image.get('src') or image.get('data-src')

    return None


def fetch_tmdb_poster_url(session: requests.Session, title: str, year: str | None) -> str | None:
    api_key = os.environ.get('TMDB_API_KEY', '').strip()
    if not api_key:
        return None

    response = session.get(
        'https://api.themoviedb.org/3/search/movie',
        params={
            'api_key': api_key,
            'query': title,
            'year': year or '',
            'include_adult': 'false',
            'language': 'zh-CN',
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    results = payload.get('results') or []
    if not results:
        return None

    poster_path = results[0].get('poster_path')
    if not poster_path:
        return None

    return f'https://image.tmdb.org/t/p/original{poster_path}'


def resolve_poster_url(session: requests.Session, record: MovieRecord) -> str:
    candidate_urls = [record.poster_url]

    if record.subject_url:
        candidate_urls.append(fetch_subject_poster_url(session, record.subject_url))

    candidate_urls.append(fetch_tmdb_poster_url(session, record.title, record.year))

    for candidate_url in candidate_urls:
        if candidate_url:
            return candidate_url

    raise RuntimeError(f'Unable to resolve poster for {record.title}')


def detect_extension(url: str, content_type: str | None) -> str:
    normalized_content_type = (content_type or '').split(';', 1)[0].strip().lower()
    if normalized_content_type in IMAGE_CONTENT_TYPES:
        return IMAGE_CONTENT_TYPES[normalized_content_type]

    path = urlparse(url).path.lower()
    for extension in IMAGE_EXTENSIONS:
        if path.endswith(extension):
            return '.jpg' if extension == '.jpeg' else extension

    return '.jpg'


def download_poster(session: requests.Session, url: str, referer: str | None = None) -> tuple[bytes, str]:
    headers = {'Referer': referer} if referer else None
    response = session.get(url, headers=headers, timeout=60)
    response.raise_for_status()
    extension = detect_extension(url, response.headers.get('Content-Type'))
    return response.content, extension


def sanitize_title(title: str) -> str:
    sanitized = INVALID_FILENAME_CHARS.sub(' ', title)
    sanitized = re.sub(r'\s+', ' ', sanitized).strip().strip('.')
    return sanitized or 'untitled'


def build_object_key(prefix: str, title: str, year: str | None, subject_url: str, extension: str, used_keys: set[str]) -> str:
    safe_title = sanitize_title(title)
    candidate_names = [safe_title]

    if year:
        candidate_names.append(f'{safe_title} ({year})')

    subject_id_match = re.search(r'/subject/(\d+)/', subject_url)
    if subject_id_match:
        candidate_names.append(f'{safe_title} [{subject_id_match.group(1)}]')

    for candidate_name in candidate_names:
        key = f'{prefix}{candidate_name}{extension}'
        if key not in used_keys:
            used_keys.add(key)
            return key

    suffix = 2
    while True:
        key = f'{prefix}{safe_title} ({suffix}){extension}'
        if key not in used_keys:
            used_keys.add(key)
            return key
        suffix += 1


def upload_poster(s3_client, bucket: str, key: str, body: bytes, extension: str) -> None:
    content_type = {
        '.jpg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.avif': 'image/avif',
    }.get(extension, 'application/octet-stream')

    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=body,
        ContentType=content_type,
        CacheControl='public, max-age=31536000, immutable',
    )


def list_existing_keys(s3_client, bucket: str, prefix: str) -> set[str]:
    keys: set[str] = set()
    continuation_token = None

    while True:
        kwargs = {'Bucket': bucket, 'Prefix': prefix}
        if continuation_token:
            kwargs['ContinuationToken'] = continuation_token

        response = s3_client.list_objects_v2(**kwargs)
        for item in response.get('Contents', []):
            key = item.get('Key')
            if key:
                keys.add(key)

        if not response.get('IsTruncated'):
            break

        continuation_token = response.get('NextContinuationToken')

    return keys


def delete_stale_keys(s3_client, bucket: str, existing_keys: set[str], desired_keys: set[str]) -> None:
    stale_keys = sorted(existing_keys - desired_keys)
    if not stale_keys:
        return

    for stale_key in stale_keys:
        print(f'Deleting stale poster: {stale_key}')
        s3_client.delete_object(Bucket=bucket, Key=stale_key)


def main() -> None:
    douban_user_id = require_env('DOUBAN_USER_ID')
    bucket = os.environ.get('R2_BUCKET', 'obsidian-vault').strip() or 'obsidian-vault'
    prefix = os.environ.get('R2_PREFIX', 'now-watching/').strip() or 'now-watching/'
    if not prefix.endswith('/'):
        prefix = f'{prefix}/'

    delete_stale = os.environ.get('SYNC_DELETE_STALE', 'true').strip().lower() == 'true'
    session = build_session()
    s3_client = build_s3_client()
    existing_keys = list_existing_keys(s3_client, bucket, prefix)
    desired_keys: set[str] = set()
    used_keys: set[str] = set()

    records = list(iterate_watched_movies(session, douban_user_id))
    if not records:
        raise RuntimeError('No watched movies were found. Check DOUBAN_USER_ID, cookie, or access restrictions.')

    for record in records:
        try:
            poster_url = resolve_poster_url(session, record)
            image_bytes, extension = download_poster(session, poster_url, referer=record.subject_url)
            object_key = build_object_key(prefix, record.title, record.year, record.subject_url, extension, used_keys)
            upload_poster(s3_client, bucket, object_key, image_bytes, extension)
            desired_keys.add(object_key)
            print(f'Uploaded {record.title} -> {object_key}')
        except Exception as error:
            print(f'Failed to sync {record.title}: {error}')

    if not desired_keys:
        raise RuntimeError('Poster sync completed without any uploaded files.')

    if delete_stale:
        delete_stale_keys(s3_client, bucket, existing_keys, desired_keys)

    print(f'Synced {len(desired_keys)} posters to s3://{bucket}/{prefix}')


if __name__ == '__main__':
    main()