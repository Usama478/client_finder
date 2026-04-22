from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.exporter_profile import ExporterProfile
from app.api.auth_routes import get_current_user
from app.models.user import User
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/api/v1/exporter-profiles", tags=["exporter-profiles"])

@router.get("/me")
def get_my_profile(current_user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    profile = db.query(ExporterProfile).filter(
        ExporterProfile.user_id == current_user.user_id,
        ExporterProfile.is_default == True
    ).first()
    if not profile:
        return None
    return profile.__dict__

@router.post("")
def create_profile(data: dict,
                   current_user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    existing = db.query(ExporterProfile).filter(
        ExporterProfile.user_id == current_user.user_id,
        ExporterProfile.is_default == True
    ).first()
    if existing:
        for key, value in data.items():
            if hasattr(existing, key):
                setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing.__dict__
    profile = ExporterProfile(
        user_id=current_user.user_id,
        is_default=True,
        **{k: v for k, v in data.items() if hasattr(ExporterProfile, k) and k not in ("is_default", "user_id")}
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile.__dict__

@router.put("/{profile_id}")
def update_profile(profile_id: int, data: dict,
                   current_user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    profile = db.query(ExporterProfile).filter(
        ExporterProfile.id == profile_id,
        ExporterProfile.user_id == current_user.user_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    for key, value in data.items():
        if hasattr(profile, key) and key not in ("id", "user_id"):
            setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile.__dict__
