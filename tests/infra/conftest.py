"""
Fixtures for Docker infrastructure tests using testinfra.

testinfra connects to a running container via Docker backend.
Usage:
    pytest tests/infra/ --hosts=docker://arthurs-blog-test

The container name 'arthurs-blog-test' matches the name in docker-compose.test.yml.
"""

import pytest


# Tell testinfra which container to target when --hosts is not provided
def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "infra: Docker infrastructure tests (requires running arthurs-blog-test container)",
    )


@pytest.fixture(scope="session")
def container_name() -> str:
    return "arthurs-blog-test"


@pytest.fixture(scope="session")
def app_port() -> int:
    """Internal port the Next.js app listens on inside the container."""
    return 3000


@pytest.fixture(scope="session")
def host_port() -> int:
    """Host port mapped to the container (defined in docker-compose.test.yml)."""
    return 3020
