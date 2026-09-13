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
from app.services import book_service


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


def test_check_library_classifies_matches_and_is_owner_scoped(db):
    owner = models.User(username="owner", email="owner@check.test", hashed_password="x", is_active=True)
    other = models.User(username="other", email="other@check.test", hashed_password="x", is_active=True)
    db.add_all([owner, other])
    db.flush()
    exact = models.Book(title="Band of Brothers", author="Stephen E. Ambrose", isbn="9780743224543", owner_id=owner.id)
    edition = models.Book(title="Band of Brothers", author="Stephen E Ambrose", isbn="9781471109257", owner_id=owner.id)
    possible = models.Book(title="Band of Brothers Companion", author="Another Writer", owner_id=owner.id)
    foreign = models.Book(title="Band of Brothers", author="Stephen E. Ambrose", isbn="9780306406157", owner_id=other.id)
    db.add_all([exact, edition, possible, foreign])
    db.commit()

    matches = book_service.check_library(
        db, owner.id, isbn="9780743224543", title="Band of Brothers", author="Stephen E. Ambrose"
    )
    by_id = {match["book"].id: match["classification"] for match in matches}
    assert by_id[exact.id] == "exact"
    assert by_id[edition.id] == "likely"
    assert by_id[possible.id] == "possible"
    assert foreign.id not in by_id


def test_check_library_supports_title_only_author_only_and_no_match(db):
    owner = models.User(username="owner-two", email="owner-two@check.test", hashed_password="x", is_active=True)
    db.add(owner)
    db.flush()
    book = models.Book(title="The Left Hand of Darkness", author="Ursula K. Le Guin", owner_id=owner.id)
    db.add(book)
    db.commit()

    assert book_service.check_library(db, owner.id, title="Left Hand")[0]["classification"] == "possible"
    assert book_service.check_library(db, owner.id, author="Le Guin")[0]["classification"] == "possible"
    assert book_service.check_library(db, owner.id, title="Entirely Unrelated") == []
