from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from ..database import SessionLocal
from .. import models, schemas
from ..auth.hashing import (
    hash_password,
    verify_password,
)
from ..auth.jwt_handler import (
    create_access_token,
)
from ..auth.dependencies import (
    get_current_user,
)

router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)


# ✅ DB Dependency
def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# ✅ REGISTER
@router.post("/register")
def register(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
):
    # Serialize the empty-install bootstrap decision across processes.
    db.execute(text("SELECT pg_advisory_xact_lock(4815162342)"))
    existing_user = (
        db.query(models.User)
        .filter(
            models.User.username
            == user.username
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username already exists",
        )

    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    is_first_user = db.query(models.User.id).first() is None

    new_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hash_password(
            user.password
        ),
        is_active=is_first_user,
        is_admin=is_first_user,
    )

    db.add(new_user)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Account already exists")

    db.refresh(new_user)

    return {
        "message":
        ("Administrator account created" if is_first_user else "Account created and awaiting approval")
    }


# ✅ LOGIN
@router.post("/login")
def login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = (
        db.query(models.User)
        .filter(
            models.User.username
            == username
        )
        .first()
    )

    if (
        not user
        or not verify_password(
            password,
            user.hashed_password,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = (
        create_access_token(
            data={
                "sub": user.username,
            }
        )
    )

    return {
        "access_token":
            access_token,
        "token_type":
            "bearer",
    }


# ✅ CURRENT USER
@router.get("/me")
def get_me(
    current_user: models.User = Depends(
        get_current_user,
    ),
):
    return {
        "id": current_user.id,
        "username":
            current_user.username,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "is_admin": current_user.is_admin,
    }
