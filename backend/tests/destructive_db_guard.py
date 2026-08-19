import os
from urllib.parse import urlparse

UNSAFE_DATABASE_NAMES = {"library", "library_db", "postgres", "template0", "template1"}


def require_disposable_database(url: str | None) -> str:
    if not url:
        raise RuntimeError("TEST_DATABASE_URL is required")
    name = urlparse(url).path.rsplit("/", 1)[-1]
    if name in UNSAFE_DATABASE_NAMES or not name.endswith("_test"):
        raise RuntimeError("Destructive tests require a database name ending in _test")
    if os.environ.get("ALLOW_DESTRUCTIVE_TEST_DATABASE") != "1":
        raise RuntimeError("Set ALLOW_DESTRUCTIVE_TEST_DATABASE=1 for destructive database tests")
    return url
