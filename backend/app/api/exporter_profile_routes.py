from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.exporter_profile import ExporterProfile
from app.api.auth_routes import get_current_user
from app.models.user import User
from pydantic import BaseModel
from typing import Optional, List

class ExporterProfileUpdate(BaseModel):
    profile_name: Optional[str] = None
    is_default: Optional[bool] = None
    company_name: Optional[str] = None
    company_location: Optional[str] = None
    year_established: Optional[int] = None
    website: Optional[str] = None
    contact_person_name: Optional[str] = None
    contact_email: Optional[str] = None
    product_categories: Optional[List[str]] = None
    key_products: Optional[List[str]] = None
    specializations: Optional[List[str]] = None
    preferred_categories_for_outreach: Optional[List[str]] = None
    moq: Optional[int] = None
    monthly_capacity: Optional[str] = None
    sampling_available: Optional[bool] = None
    sampling_turnaround_days: Optional[int] = None
    bulk_lead_time_days: Optional[int] = None
    sample_policy: Optional[str] = None
    minimum_order_flexibility_note: Optional[str] = None
    certifications: Optional[List[str]] = None
    export_markets: Optional[List[str]] = None
    client_types: Optional[List[str]] = None
    target_buyer_types: Optional[List[str]] = None
    value_proposition: Optional[str] = None
    production_strengths: Optional[List[str]] = None
    services: Optional[List[str]] = None
    shipping_terms: Optional[List[str]] = None

router = APIRouter(prefix="/api/v1/exporter-profiles", tags=["exporter-profiles"])

ALLOWED_FIELDS = {
    "profile_name", "company_name", "company_location", "year_established",
    "website", "contact_person_name", "contact_email", "product_categories",
    "key_products", "specializations", "preferred_categories_for_outreach",
    "moq", "monthly_capacity", "sampling_available", "sampling_turnaround_days",
    "bulk_lead_time_days", "sample_policy", "minimum_order_flexibility_note",
    "certifications", "export_markets", "client_types", "target_buyer_types",
    "value_proposition", "production_strengths", "services", "shipping_terms",
}

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
            if key in ALLOWED_FIELDS:
                setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing.__dict__
    profile_data = data.model_dump(exclude_none=True)
    profile_data["user_id"] = current_user.user_id
    profile_data["is_default"] = True
    profile = ExporterProfile(**profile_data)
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
        if key in ALLOWED_FIELDS:
            setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile.__dict__
