import os
import asyncio

import pytest
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
from app.auth.hashing import hash_password
from app.auth.jwt_handler import create_access_token
from app.main import app
from app.routers import auth
from app.services.provider_settings_service import ensure_default_provider_settings
from app.services.providers import manager


@pytest.fixture()
def db():
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    session.query(models.ProviderSetting).delete()
    session.query(models.Book).delete()
    session.query(models.User).delete()
    session.commit()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db):
    def override_db():
        yield db
    app.dependency_overrides[database.get_db] = override_db
    app.dependency_overrides[auth.get_db] = override_db
    with TestClient(app) as value:
        yield value
    app.dependency_overrides.clear()


def register(client, username, email):
    return client.post("/auth/register", json={"username": username, "email": email, "password": "secret123"})


def token_headers(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': user.username})}"}


def test_registration_bootstrap_duplicates_and_inactive_login(client, db):
    assert register(client, "first", "first@example.test").status_code == 200
    first = db.query(models.User).filter_by(username="first").one()
    assert first.is_active and first.is_admin
    assert register(client, "second", "second@example.test").status_code == 200
    second = db.query(models.User).filter_by(username="second").one()
    assert not second.is_active and not second.is_admin
    assert register(client, "first", "other@example.test").status_code == 400
    assert register(client, "other", "second@example.test").status_code == 400
    assert client.post("/auth/login", data={"username": "second", "password": "secret123"}).status_code == 401
    assert client.post("/auth/login", data={"username": "first", "password": "secret123"}).status_code == 200


def test_admin_user_management_and_authorization(client, db):
    admin = models.User(username="admin", email="admin@example.test", hashed_password=hash_password("x"), is_active=True, is_admin=True)
    normal = models.User(username="normal", email="normal@example.test", hashed_password=hash_password("x"), is_active=True, is_admin=False)
    pending = models.User(username="pending", email="pending@example.test", hashed_password=hash_password("x"), is_active=False, is_admin=False)
    db.add_all([admin, normal, pending]); db.commit()
    assert client.get("/admin/users/pending", headers=token_headers(normal)).status_code == 403
    response = client.get("/admin/users/pending", headers=token_headers(admin))
    assert [item["username"] for item in response.json()] == ["pending"]
    assert client.post(f"/admin/users/{pending.id}/approve", headers=token_headers(admin)).status_code == 200
    pending.is_active = False; db.commit()
    assert client.delete(f"/admin/users/{pending.id}", headers=token_headers(admin)).status_code == 204


def test_provider_settings_secret_is_write_only(client, db):
    admin = models.User(username="admin", email="admin@example.test", hashed_password="x", is_active=True, is_admin=True)
    normal = models.User(username="normal", email="normal@example.test", hashed_password="x", is_active=True, is_admin=False)
    provider = models.ProviderSetting(provider_name="test", api_key="original", priority=1, timeout_seconds=5, max_retries=1)
    db.add_all([admin, normal, provider]); db.commit()
    assert client.get("/provider-settings/", headers=token_headers(normal)).status_code == 403
    response = client.get("/provider-settings/", headers=token_headers(admin))
    test_response = next(item for item in response.json() if item["provider_name"] == "test")
    assert response.status_code == 200 and test_response["has_api_key"] is True
    assert "api_key" not in test_response and "original" not in response.text
    client.put(f"/provider-settings/{provider.id}", json={"timeout_seconds": 10}, headers=token_headers(admin)); db.refresh(provider)
    assert provider.api_key == "original"
    client.put(f"/provider-settings/{provider.id}", json={"api_key": "replacement"}, headers=token_headers(admin)); db.refresh(provider)
    assert provider.api_key == "replacement"
    response = client.put(f"/provider-settings/{provider.id}", json={"clear_api_key": True}, headers=token_headers(admin)); db.refresh(provider)
    assert provider.api_key is None and response.json()["has_api_key"] is False


def test_default_provider_initialization_is_idempotent_and_preserves_existing(db):
    existing = models.ProviderSetting(
        provider_name="google_books", enabled=False, priority=99,
        api_key="keep-me", timeout_seconds=17, max_retries=1,
    )
    db.add(existing); db.commit()
    ensure_default_provider_settings(db)
    ensure_default_provider_settings(db)
    providers = db.query(models.ProviderSetting).order_by(models.ProviderSetting.provider_name).all()
    assert len(providers) == 2
    google = next(item for item in providers if item.provider_name == "google_books")
    openlibrary = next(item for item in providers if item.provider_name == "openlibrary")
    assert (google.enabled, google.priority, google.api_key, google.timeout_seconds) == (False, 99, "keep-me", 17)
    assert (openlibrary.enabled, openlibrary.priority) == (True, 2)


def test_admin_get_creates_and_returns_default_providers(client, db):
    admin = models.User(username="admin", email="admin@example.test", hashed_password="x", is_active=True, is_admin=True)
    db.add(admin); db.commit()
    response = client.get("/provider-settings/", headers=token_headers(admin))
    assert response.status_code == 200
    providers = {item["provider_name"]: item for item in response.json()}
    assert set(providers) == {"google_books", "openlibrary"}
    assert (providers["google_books"]["priority"], providers["google_books"]["enabled"]) == (1, True)
    assert (providers["openlibrary"]["priority"], providers["openlibrary"]["enabled"]) == (2, True)
    assert all("api_key" not in item for item in response.json())


def test_provider_lookup_initializes_empty_provider_table(db, monkeypatch):
    class FakeProvider:
        def __init__(self, setting):
            self.setting = setting

        async def fetch_book_by_isbn(self, isbn):
            return {"title": self.setting.provider_name, "isbn": isbn}

    monkeypatch.setattr(manager, "PROVIDER_MAP", {
        "google_books": FakeProvider, "openlibrary": FakeProvider,
    })
    results = asyncio.run(manager.fetch_all_provider_results(db, "9780306406157"))
    assert [result.provider for result in results] == ["google_books", "openlibrary"]
    assert all(result.success for result in results)


def test_provider_lookup_auth_and_validation(client, db, monkeypatch):
    active = models.User(username="active", email="active@example.test", hashed_password="x", is_active=True, is_admin=False)
    inactive = models.User(username="inactive", email="inactive@example.test", hashed_password="x", is_active=False, is_admin=False)
    db.add_all([active, inactive]); db.commit()
    assert client.get("/books/preview-isbn/9780306406157").status_code == 401
    assert client.get("/books/preview-isbn/9780306406157", headers=token_headers(inactive)).status_code == 401
    assert client.get("/books/preview-isbn/not-an-isbn", headers=token_headers(active)).status_code == 422
    async def fake_fetch(_db, isbn):
        return {"title": "Test", "author": "Author", "isbn": isbn}
    monkeypatch.setattr("app.routers.books.fetch_book_by_isbn", fake_fetch)
    assert client.get("/books/preview-isbn/9780306406157", headers=token_headers(active)).status_code == 200
