"""API tests for the markdown_themes domain."""

import allure
import httpx
import pytest


@allure.feature("Markdown Themes")
@allure.story("Status")
class TestMarkdownThemes:

    @pytest.mark.smoke
    def test_library_only(self):
        """Markdown themes is a library module, not an HTTP endpoint."""
        pytest.skip("No HTTP endpoint exists directly for the markdown_themes domain")
