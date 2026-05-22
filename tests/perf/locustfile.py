"""
Performance smoke tests for arthurs-blog.

Runs from GitHub Actions cloud runner against:
  https://test.arthurlovegrace.top  (staging, via OpenResty → port 3020)

Usage:
  # Interactive UI (development)
  locust -f tests/perf/locustfile.py --host https://test.arthurlovegrace.top

  # Headless CI mode
  locust -f tests/perf/locustfile.py \\
    --headless -u 20 -r 2 --run-time 60s \\
    --host https://test.arthurlovegrace.top \\
    --csv tests/perf/results \\
    --exit-code-on-error 1 \\
    --html tests/perf/report.html

Scale context: 20 concurrent users for 60s is a performance smoke test, not a
capacity test. Goal: catch regressions (p95 spike or sudden error rate rise).

User mix (weights reflect real traffic distribution):
  BlogReaderUser   (weight 5) — homepage, article pages, search, category/tag/archive
  MemoGuestbookUser(weight 2) — /memo, /guestbook, memo API
  RecipeReaderUser (weight 1) — /recipe page, recipe API
  ContentPageUser  (weight 1) — /spotify, /now-watching, /trend-radar
"""

import random
from urllib.parse import quote

from locust import HttpUser, between, events, task


# ── Runtime-discovered data (populated at test_start) ────────────────────────
BLOG_SLUGS: list[str] = []
CATEGORY_SLUGS: list[str] = []
TAG_SLUGS: list[str] = []
ARCHIVE_YEARS: list[str] = []
RECIPE_SLUGS: list[str] = []

BLOG_SEARCH_QUERIES = ["memo", "spotify", "recipe", "life", "note", "wardrobe", "blog", "the"]


@events.test_start.add_listener
def discover_test_data(environment, **kwargs):
    """Fetch real slugs, categories, tags, and years before load starts."""
    import json as _json
    import urllib.request

    host = environment.host.rstrip("/")

    # Blog slugs, categories, tags, archive years — all from the search API
    for query in ["blog", "memo", "spotify", "the", "life", "note"]:
        try:
            url = f"{host}/api/blog/search?q={query}&limit=10"
            with urllib.request.urlopen(url, timeout=8) as r:
                data = _json.loads(r.read())
                for result in data.get("results", []):
                    slug = result.get("slug")
                    if slug and slug not in BLOG_SLUGS:
                        BLOG_SLUGS.append(slug)
                    category = result.get("category")
                    if category and category not in CATEGORY_SLUGS:
                        CATEGORY_SLUGS.append(category)
                    for tag in result.get("tags", []):
                        if tag not in TAG_SLUGS:
                            TAG_SLUGS.append(tag)
                    published_at = result.get("published_at")
                    if published_at:
                        year = published_at[:4]
                        if year not in ARCHIVE_YEARS:
                            ARCHIVE_YEARS.append(year)
        except Exception:
            pass

    # Recipe slugs — from /api/recipes
    try:
        with urllib.request.urlopen(f"{host}/api/recipes", timeout=5) as r:
            recipes = _json.loads(r.read())
            if isinstance(recipes, list):
                RECIPE_SLUGS.extend(item["slug"] for item in recipes if "slug" in item)
    except Exception:
        pass

    print(
        f"[test_start] blog_slugs={len(BLOG_SLUGS)}, categories={len(CATEGORY_SLUGS)}, "
        f"tags={len(TAG_SLUGS)}, years={len(ARCHIVE_YEARS)}, recipes={len(RECIPE_SLUGS)}"
    )


# ── User types ────────────────────────────────────────────────────────────────

class BlogReaderUser(HttpUser):
    """
    Core blog reading flow: homepage → article → search → filtered listing.
    Highest weight (5) because this represents the majority of real traffic.
    """

    wait_time = between(1, 3)
    weight = 5

    @task(4)
    def browse_home(self):
        with self.client.get("/", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"Home returned {resp.status_code}")

    @task(5)
    def read_blog_post(self):
        if not BLOG_SLUGS:
            return
        slug = random.choice(BLOG_SLUGS)
        with self.client.get(
            f"/blog/{slug}",
            name="/blog/[slug]",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Blog post returned {resp.status_code}")

    @task(3)
    def search_api(self):
        q = random.choice(BLOG_SEARCH_QUERIES)
        with self.client.get(
            f"/api/blog/search?q={q}&limit=6",
            name="/api/blog/search",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Search API returned {resp.status_code}")

    @task(2)
    def search_page(self):
        q = random.choice(BLOG_SEARCH_QUERIES)
        with self.client.get(
            f"/search?q={q}",
            name="/search",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Search page returned {resp.status_code}")

    @task(2)
    def browse_category(self):
        if not CATEGORY_SLUGS:
            return
        slug = random.choice(CATEGORY_SLUGS)
        with self.client.get(
            f"/category/{quote(slug)}",
            name="/category/[slug]",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Category page returned {resp.status_code}")

    @task(1)
    def browse_tag(self):
        if not TAG_SLUGS:
            return
        tag = random.choice(TAG_SLUGS)
        with self.client.get(
            f"/tag/{quote(tag)}",
            name="/tag/[slug]",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Tag page returned {resp.status_code}")

    @task(1)
    def browse_archive(self):
        if not ARCHIVE_YEARS:
            return
        year = random.choice(ARCHIVE_YEARS)
        with self.client.get(
            f"/archive/{year}",
            name="/archive/[year]",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Archive page returned {resp.status_code}")


class MemoGuestbookUser(HttpUser):
    """Note board pages: memo list/search and guestbook."""

    wait_time = between(1, 4)
    weight = 2

    @task(3)
    def browse_memo(self):
        with self.client.get("/memo", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"/memo returned {resp.status_code}")

    @task(2)
    def list_memo_api(self):
        with self.client.get(
            "/api/note-boards/memo",
            name="/api/note-boards/memo",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Memo list API returned {resp.status_code}")

    @task(2)
    def search_memo_api(self):
        with self.client.get(
            "/api/note-boards/memo/search?q=memo",
            name="/api/note-boards/memo/search",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Memo search returned {resp.status_code}")

    @task(2)
    def browse_guestbook(self):
        with self.client.get("/guestbook", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"/guestbook returned {resp.status_code}")


class RecipeReaderUser(HttpUser):
    """Recipe section: book shell page and recipe API."""

    wait_time = between(2, 5)
    weight = 1

    @task(2)
    def browse_recipe_page(self):
        with self.client.get("/recipe", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"/recipe returned {resp.status_code}")

    @task(2)
    def list_recipes_api(self):
        with self.client.get(
            "/api/recipes",
            name="/api/recipes",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"/api/recipes returned {resp.status_code}")

    @task(1)
    def view_recipe_api(self):
        if not RECIPE_SLUGS:
            return
        slug = random.choice(RECIPE_SLUGS)
        with self.client.get(
            f"/api/recipes/{slug}",
            name="/api/recipes/[slug]",
            catch_response=True,
        ) as resp:
            if resp.status_code not in (200, 404):
                resp.failure(f"Recipe detail returned {resp.status_code}")


class ContentPageUser(HttpUser):
    """Standalone content pages backed by R2/external data."""

    wait_time = between(2, 5)
    weight = 1

    @task(3)
    def browse_spotify(self):
        with self.client.get("/spotify", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"/spotify returned {resp.status_code}")

    @task(2)
    def browse_now_watching(self):
        with self.client.get("/now-watching", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"/now-watching returned {resp.status_code}")

    @task(1)
    def browse_trend_radar(self):
        with self.client.get("/trend-radar", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"/trend-radar returned {resp.status_code}")
