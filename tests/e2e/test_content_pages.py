"""
E2E tests for standalone content pages.

Coverage:
  - /spotify        — Spotify listening history & stats dashboard
  - /now-watching   — Movie/TV watch log
  - /trend-radar    — Trending topics radar

These pages depend on external data (Cloudflare R2, Spotify API) that may not be
available in the test environment. Tests assert structural integrity (main element,
no server errors) rather than data presence.
"""

import allure
import pytest
from playwright.sync_api import Page, expect


@allure.feature("E2E")
@allure.story("Spotify")
class TestSpotifyPage:

    @pytest.mark.smoke
    def test_spotify_page_loads(self, page: Page, base_url: str):
        page.goto(f"{base_url}/spotify", wait_until="domcontentloaded")
        expect(page).not_to_have_title("404")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")

    def test_spotify_page_has_main(self, page: Page, base_url: str):
        page.goto(f"{base_url}/spotify")
        # Streaming SSR may deliver <main> after networkidle; wait on the element directly.
        expect(page.locator("main")).to_be_visible(timeout=20000)

    def test_spotify_page_has_navbar(self, page: Page, base_url: str):
        page.goto(f"{base_url}/spotify", wait_until="domcontentloaded")
        expect(page.locator("nav").first).to_be_visible()


@allure.feature("E2E")
@allure.story("Now Watching")
class TestNowWatchingPage:

    @pytest.mark.smoke
    def test_now_watching_page_loads(self, page: Page, base_url: str):
        page.goto(f"{base_url}/now-watching", wait_until="domcontentloaded")
        expect(page).not_to_have_title("404")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")

    def test_now_watching_page_has_content(self, page: Page, base_url: str):
        page.goto(f"{base_url}/now-watching")
        page.wait_for_load_state("networkidle", timeout=15000)
        # Page renders a section element (openSans font wrapper)
        expect(page.locator("section, main").first).to_be_visible()



@allure.feature("E2E")
@allure.story("Trend Radar")
class TestTrendRadarPage:

    @pytest.mark.smoke
    def test_trend_radar_page_loads(self, page: Page, base_url: str):
        page.goto(f"{base_url}/trend-radar", wait_until="domcontentloaded")
        expect(page).not_to_have_title("404")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")

    def test_trend_radar_page_has_main(self, page: Page, base_url: str):
        page.goto(f"{base_url}/trend-radar")
        page.wait_for_load_state("networkidle", timeout=15000)
        expect(page.locator("main")).to_be_visible()

    def test_trend_radar_page_has_navbar(self, page: Page, base_url: str):
        page.goto(f"{base_url}/trend-radar", wait_until="domcontentloaded")
        expect(page.locator("nav").first).to_be_visible()
