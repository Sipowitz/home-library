import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi import HTTPException
from jose import jwt

from app import models
from app.auth.dependencies import get_current_admin_user, get_current_user
from app.auth.jwt_handler import ALGORITHM, SECRET_KEY, create_access_token


def _run_isolated(code: str, *, cwd: Path, env: dict[str, str]) -> None:
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=cwd,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def test_process_environment_secret_is_authoritative():
    env = os.environ.copy()
    env.update(DATABASE_URL="postgresql://unused:unused@localhost/unused", SECRET_KEY="process-only-secret")
    _run_isolated(
        "from app.core.config import settings; from app.auth.jwt_handler import SECRET_KEY; "
        "assert settings.SECRET_KEY == SECRET_KEY == 'process-only-secret'",
        cwd=Path(__file__).resolve().parents[1],
        env=env,
    )


def test_dotenv_only_secret_is_authoritative(tmp_path):
    (tmp_path / ".env").write_text(
        "DATABASE_URL=postgresql://unused:unused@localhost/unused\nSECRET_KEY=dotenv-only-secret\n"
    )
    env = os.environ.copy()
    env.pop("SECRET_KEY", None)
    env.pop("DATABASE_URL", None)
    env["PYTHONPATH"] = str(Path(__file__).resolve().parents[1])
    _run_isolated(
        "from app.core.config import settings; from app.auth.jwt_handler import SECRET_KEY, create_access_token; "
        "from jose import jwt; assert settings.SECRET_KEY == SECRET_KEY == 'dotenv-only-secret'; "
        "jwt.decode(create_access_token({'sub':'user'}), SECRET_KEY, algorithms=['HS256'])",
        cwd=tmp_path,
        env=env,
    )


def test_unrelated_fallback_secret_is_rejected():
    forged = jwt.encode(
        {"sub": "active", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        "your-secret-key",
        algorithm=ALGORITHM,
    )
    class Query:
        def filter(self, *_args): return self
        def first(self): return models.User(username="active", is_active=True)
    class DB:
        def query(self, *_args): return Query()
    with pytest.raises(HTTPException) as raised:
        get_current_user(forged, DB())
    assert raised.value.status_code == 401


def test_expired_token_is_rejected():
    expired = jwt.encode(
        {"sub": "active", "exp": datetime.now(timezone.utc) - timedelta(seconds=1)},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    class DB:
        def query(self, *_args): raise AssertionError("expired token must fail before querying")
    with pytest.raises(HTTPException) as raised:
        get_current_user(expired, DB())
    assert raised.value.status_code == 401


def test_inactive_and_admin_checks_remain_database_authoritative():
    inactive = models.User(username="inactive", is_active=False, is_admin=True)
    token = create_access_token({"sub": inactive.username})
    class Query:
        def filter(self, *_args): return self
        def first(self): return inactive
    class DB:
        def query(self, *_args): return Query()
    with pytest.raises(HTTPException) as raised:
        get_current_user(token, DB())
    assert raised.value.status_code == 401

    with pytest.raises(HTTPException) as raised:
        get_current_admin_user(models.User(is_active=True, is_admin=False))
    assert raised.value.status_code == 403
    admin = models.User(is_active=True, is_admin=True)
    assert get_current_admin_user(admin) is admin
