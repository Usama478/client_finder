from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.exporter_profile import ExporterProfile
from app.api.auth_routes import get_current_user
from app.models.user import User
from pydantic import BaseModel
from typing import Optional, List

class ExporterProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    company_website: Optional[str] = None
    company_description: Optional[str] = None
    target_market: Optional[str] = None
    product_categories: Optional[str] = None
    export_experience: Optional[str] = None
    preferred_regions: Optional[str] = None
    annual_revenue: Optional[str] = None
    employee_count: Optional[str] = None
    certifications: Optional[str] = None

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
def create_profile(data: ExporterProfileUpdate,
                   current_user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    existing = db.query(ExporterProfile).filter(
        ExporterProfile.user_id == current_user.user_id,
        ExporterProfile.is_default == True
    ).first()
    if existing:
        update_data = data.model_dump(exclude_none=True)
        for key, value in update_data.items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing.__dict__
    profile = ExporterProfile(
        user_id=current_user.user_id,
        is_default=True,
        **data.model_dump(exclude_none=True)
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile.__dict__

@router.put("/{profile_id}")
def update_profile(profile_id: int, data: ExporterProfileUpdate,
                   current_user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    profile = db.query(ExporterProfile).filter(
        ExporterProfile.id == profile_id,
        ExporterProfile.user_id == current_user.user_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    update_data = data.model_dump(exclude_none=True)
    for key, value in update_data.items():
        if key not in ("id", "user_id", "is_default"):
            setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile.__dict__
