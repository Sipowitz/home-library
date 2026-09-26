"""Persistent bearer-JWT authentication coverage; disposable PostgreSQL only."""
import os
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from jose import jwt
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
from app.auth.jwt_handler import ACCESS_TOKEN_EXPIRE_DELTA, ALGORITHM, SECRET_KEY
from app.main import app
from app.routers import auth


@pytest.fixture()
def db():
    engine = create_engine(TEST_DATABASE_URL)
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    session.add(models.User(username="reader", email="reader@example.test", hashed_password=hash_password("secret123"), is_active=True))
    session.commit()
    try:
        yield session
    finally:
        session.close()
        models.Base.metadata.drop_all(engine)
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


def test_login_issues_a_ten_year_bearer_token_with_expected_claims(client):
    before = datetime.now(timezone.utc)
    response = client.post("/auth/login", data={"username": "reader", "password": "secret123"})
    after = datetime.now(timezone.utc)

    assert response.status_code == 200
    token = response.json()["access_token"]
    claims = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
    assert response.json()["token_type"] == "bearer"
    assert claims["sub"] == "reader"
    expires_at = datetime.fromtimestamp(claims["exp"], timezone.utc)
    assert before + ACCESS_TOKEN_EXPIRE_DELTA - timedelta(seconds=1) <= expires_at <= after + ACCESS_TOKEN_EXPIRE_DELTA
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def test_expired_and_malformed_tokens_still_fail_authentication(client):
    expired = jwt.encode(
        {"sub": "reader", "exp": datetime.now(timezone.utc) - timedelta(seconds=1)},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )

    assert client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer malformed"}).status_code == 401
