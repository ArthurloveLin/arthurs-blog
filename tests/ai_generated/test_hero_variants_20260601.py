# tested-source: lib/hero-variants.ts
"""API tests for the hero_variants domain."""

import allure
import httpx
import pytest


@allure.feature("Hero Variants")
@allure.story("Status")
class TestHeroVariants:

    @pytest.mark.smoke
    def test_library_only(self):
        """Hero variants is a library module, not an HTTP endpoint."""
        pytest.skip("No HTTP endpoint exists directly for the hero_variants domain")
