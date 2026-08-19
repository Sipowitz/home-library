"""Establish guarded test configuration before application modules import."""

import os

from destructive_db_guard import require_disposable_database


test_database_url = os.environ.get("TEST_DATABASE_URL")
if test_database_url:
    require_disposable_database(test_database_url)
    os.environ["DATABASE_URL"] = test_database_url

os.environ.setdefault("DATABASE_URL", "postgresql://unused:unused@localhost/unused")
os.environ.setdefault("SECRET_KEY", "test-suite-secret-not-for-production")
