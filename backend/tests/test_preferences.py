import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from destructive_db_guard import require_disposable_database


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="requires disposable PostgreSQL")
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app import models
from app.services import preferences_service


@pytest.fixture()
def db():
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        models.Base.metadata.drop_all(engine)
        engine.dispose()


def test_stats_visibility_defaults_enabled_for_existing_behavior(db):
    user = models.User(username="preferences-owner", email="preferences@example.test", hashed_password="x")
    db.add(user)
    db.commit()

    preferences = preferences_service.get_preferences(db, user.id)

    assert preferences.show_stats_desktop is True
    assert preferences.show_stats_mobile is True


def test_stats_visibility_preferences_update_independently(db):
    user = models.User(username="preferences-owner-two", email="preferences-two@example.test", hashed_password="x")
    db.add(user)
    db.commit()

    updated = preferences_service.update_preferences(db, user.id, {"show_stats_desktop": False})
    assert updated.show_stats_desktop is False
    assert updated.show_stats_mobile is True

    updated = preferences_service.update_preferences(db, user.id, {"show_stats_mobile": False})
    assert updated.show_stats_desktop is False
    assert updated.show_stats_mobile is False
