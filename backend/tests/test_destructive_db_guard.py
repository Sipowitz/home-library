import pytest

from destructive_db_guard import require_disposable_database


@pytest.mark.parametrize("name", ["library", "library_db", "postgres", "template0", "template1", "anything"])
def test_rejects_unsafe_database_names(monkeypatch, name):
    monkeypatch.setenv("ALLOW_DESTRUCTIVE_TEST_DATABASE", "1")
    with pytest.raises(RuntimeError):
        require_disposable_database(f"postgresql://localhost/{name}")


def test_requires_opt_in(monkeypatch):
    monkeypatch.delenv("ALLOW_DESTRUCTIVE_TEST_DATABASE", raising=False)
    with pytest.raises(RuntimeError):
        require_disposable_database("postgresql://localhost/library_security_test")


def test_accepts_safe_opted_in_database(monkeypatch):
    monkeypatch.setenv("ALLOW_DESTRUCTIVE_TEST_DATABASE", "1")
    assert require_disposable_database("postgresql://localhost/library_security_test")
