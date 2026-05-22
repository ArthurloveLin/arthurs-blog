"""
Performance smoke tests for arthurs-blog.

Runs from GitHub Actions cloud runner against:
  https://test.arthurlovegrace.top  (staging, via OpenResty → port 3020)

Usage:
  # Interactive UI (development)
  locust -f tests/perf/locustfile.py --host https://test.arthurlovegrace.top

  # Headless CI mode (see tests.yml)
  locust -f tests/perf/locustfile.py \\
    --headless -u 20 -r 2 --run-time 60s \\
    --host https://test.arthurlovegrace.top \\
    --csv tests/perf/results \\
    --exit-code-on-error 1

Scale context: 20 concurrent users for 60s is a "performance smoke test",
not a capacity test. Goal: catch regressions (p95 > 1000ms or error rate > 1%).
"""

import random

from locust import HttpUser, between, task


BLOG_SEARCH_QUERIES = ["memo", "spotify", "recipe", "life", "note", "wardrobe"]
RECIPE_SLUGS = ["mapo-tofu", "gongbao-chicken", "huiguorou"]  # from seed data


class BlogReaderUser(HttpUser):
    """Simulates a typical blog visitor: browses, searches, reads recipes."""

    wait_time = between(1, 3)
    weight = 3  # 3x more blog readers than recipe readers

    @task(4)
    def browse_home(self):
        with self.client.get("/", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"Home returned {resp.status_code}")

    @task(3)
    def search_posts(self):
        q = random.choice(BLOG_SEARCH_QUERIES)
        with self.client.get(
            f"/api/blog/search?q={q}&limit=6",
            name="/api/blog/search",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Search returned {resp.status_code}")

    @task(2)
    def browse_memo(self):
        with self.client.get("/memo", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"/memo returned {resp.status_code}")

    @task(1)
    def list_recipes(self):
        with self.client.get("/api/recipes", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"/api/recipes returned {resp.status_code}")


class RecipeReaderUser(HttpUser):
    """Simulates a user browsing the recipe section."""

    wait_time = between(2, 5)
    weight = 1

    @task(2)
    def list_recipes(self):
        self.client.get("/api/recipes", name="/api/recipes")

    @task(1)
    def view_recipe(self):
        slug = random.choice(RECIPE_SLUGS)
        with self.client.get(
            f"/api/recipes/{slug}",
            name="/api/recipes/[slug]",
            catch_response=True,
        ) as resp:
            if resp.status_code not in (200, 404):
                resp.failure(f"Recipe detail returned {resp.status_code}")

    @task(1)
    def search_memo(self):
        with self.client.get(
            "/api/note-boards/memo/search?q=memo",
            name="/api/note-boards/memo/search",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Memo search returned {resp.status_code}")
