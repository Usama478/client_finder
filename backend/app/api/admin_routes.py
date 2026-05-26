from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Literal
from app.core.security import get_current_admin_user
from app.db.session import get_db
from app.models.user import User
from app.models.user_credit import UserCredit
from app.services.credit_service import add_credits, set_credits, deduct_credits

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

class UserWithCredits(BaseModel):
    user_id: int
    name: str
    email: str
    is_active: bool
    is_admin: bool
    is_verified: bool
    credits_remaining: int
    
    class Config:
        from_attributes = True

class CreditActionRequest(BaseModel):
    action: Literal["add", "subtract", "set"]
    amount: int

@router.get("/users", response_model=List[UserWithCredits])
def get_all_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    users = db.query(User).all()
    result = []
    for user in users:
        credit = db.query(UserCredit).filter(UserCredit.user_id == user.user_id).first()
        result.append(UserWithCredits(
            user_id=user.user_id,
            name=user.name,
            email=user.email,
            is_active=user.is_active,
            is_admin=user.is_admin,
            is_verified=user.is_verified,
            credits_remaining=credit.credits_remaining if credit else 0
        ))
    return result

@router.post("/users/{user_id}/credits")
def manage_user_credits(
    user_id: int,
    request: CreditActionRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if request.action == "add":
        new_balance = add_credits(db, user_id, request.amount, reason="admin_add")
    elif request.action == "subtract":
        new_balance = deduct_credits(db, user_id, request.amount, action_type="admin_subtract")
    elif request.action == "set":
        new_balance = set_credits(db, user_id, request.amount)
    
    db.commit()
    return {"user_id": user_id, "action": request.action, "amount": request.amount, "new_balance": new_balance}

@router.post("/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = not user.is_active
    db.commit()
    return {"user_id": user_id, "is_active": user.is_active}

@router.get("/health")
def admin_health(admin_user: User = Depends(get_current_admin_user)):
    return {"status": "ok", "service": "admin"}
