"""User-facing Collection terminology for shared Group/Series endpoints."""

import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from destructive_db_guard import require_disposable_database


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="requires disposable PostgreSQL")
if TEST_DATABASE_URL:
    require_disposable_database(TEST_DATABASE_URL)
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app import database, models
from app.auth.jwt_handler import create_access_token
from app.routers import series


@pytest.fixture()
def context():
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    owner = models.User(username="terminology-owner", email="terminology@example.test", hashed_password="x", is_active=True)
    db.add(owner)
    db.commit()

    def override_db():
        yield db

    app = FastAPI()
    app.include_router(series.router)
    app.dependency_overrides[series.get_db] = override_db
    app.dependency_overrides[database.get_db] = override_db
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {create_access_token({'sub': owner.username})}"}
    try:
        yield client, headers
    finally:
        client.close()
        db.close()
        models.Base.metadata.drop_all(engine)
        engine.dispose()


def test_shared_collection_endpoint_errors_are_collection_neutral(context):
    client, headers = context

    missing_collection = client.get("/series/999", headers=headers)
    assert missing_collection.status_code == 404
    assert missing_collection.json()["detail"] == "Collection not found"

    missing_membership = client.delete("/series/999/books/999", headers=headers)
    assert missing_membership.status_code == 404
    assert missing_membership.json()["detail"] == "Collection membership not found"
