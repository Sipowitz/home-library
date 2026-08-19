from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth.dependencies import get_current_admin_user
from app.database import get_db

router = APIRouter(prefix="/admin/users", tags=["Admin Users"])


@router.get("/pending", response_model=list[schemas.UserResponse])
def pending_users(db: Session = Depends(get_db), _admin=Depends(get_current_admin_user)):
    return db.query(models.User).filter(models.User.is_active.is_(False)).order_by(models.User.created_at).all()


@router.post("/{user_id}/approve", response_model=schemas.UserResponse)
def approve_user(user_id: int, db: Session = Depends(get_db), _admin=Depends(get_current_admin_user)):
    user = db.query(models.User).filter(models.User.id == user_id, models.User.is_active.is_(False)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Pending user not found")
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def reject_user(user_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin_user)):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.query(models.User).filter(models.User.id == user_id, models.User.is_active.is_(False)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Pending user not found")
    db.delete(user)
    db.commit()
    return Response(status_code=204)
