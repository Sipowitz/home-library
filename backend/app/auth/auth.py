from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import Form

from ..database import SessionLocal
from .. import models
from ..auth.hashing import verify_password
from ..auth.jwt_handler import create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/login")
def login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(
        models.User.username == username
    ).first()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(data={"sub": user.username})

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
