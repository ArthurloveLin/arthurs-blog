"""API tests for the site_themes domain."""

import allure
import httpx
import pytest


@allure.feature("Site Themes")
@allure.story("Status")
class TestSiteThemes:

    @pytest.mark.smoke
    def test_library_only(self):
        """Site themes is a library module, not an HTTP endpoint."""
        pytest.skip("No HTTP endpoint exists directly for the site_themes domain")
