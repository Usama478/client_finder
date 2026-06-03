from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.core.limiter import limiter
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from app.db.session import get_db
from app.models.user import User
from app.models.search_context import SearchContext
from app.core.security import (
    verify_password, hash_password,
    create_access_token, decode_access_token
)
from app.services.credit_service import initialize_credits
from app.services.email_service import send_verification_email, send_password_reset_email
import secrets
from datetime import datetime, timedelta, timezone
import re

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def validate_password(password: str) -> str | None:
    if len(password) < 8:
        return "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter."
    if not re.search(r"[0-9]", password):
        return "Password must contain at least one number."
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Password must contain at least one special character."
    return None


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    name: str
    email: str
    is_admin: bool

class UserResponse(BaseModel):
    user_id: int
    name: str
    email: str
    is_admin: bool

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = db.query(User).filter(
        User.user_id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/signup")
@limiter.limit("3/minute")
def signup(request: Request, body: SignupRequest, db: Session = Depends(get_db)):
    password_error = validate_password(body.password)
    if password_error:
        raise HTTPException(status_code=422, detail=password_error)
    existing = db.query(User).filter(
        User.email == body.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists."
        )
    verification_token = secrets.token_urlsafe(32)
    verification_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    user = User(
        name=body.name.strip(),
        email=body.email.lower().strip(),
        password_hash=hash_password(body.password),
        is_verified=True,
        is_active=True,
        verification_token=verification_token,
        verification_token_expires=verification_expires,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    initialize_credits(db, user.user_id, 200)
    default_context = SearchContext(
        user_id=user.user_id,
        name="Default Search Context",
        prompt_text=(
            """EXPORTER PROFILE
================
Business Type: [e.g. Manufacturer / Trader / Both]
Products: [e.g. cotton bed sheets, terry towels, kids wear]
Product Categories: [e.g. Home Textiles, Apparel, Sportswear]
Country of Origin: [e.g. Pakistan]
Export Markets: [e.g. USA, UK, Germany, Australia]

WHAT I AM LOOKING FOR
======================
Target Buyer Type: [e.g. Wholesale importers / Retail chains / Online stores / Distributors]
Target Business Size: [e.g. Small boutiques / Mid-size retailers / Large chains]
Target Countries: [e.g. United States, United Kingdom, Canada]
Preferred Niches: [e.g. luxury home goods, baby products, eco-friendly apparel]

WHAT TO AVOID
=============
Exclude Business Types: [e.g. Marketplaces like Amazon/eBay, Dropshippers, Agencies]
Exclude Countries: [e.g. India, China]

OUTREACH CONTEXT
================
My Value Proposition: [e.g. ISO certified, 10 years export experience, MOQ from 500 pcs]
Tone of Outreach: [e.g. Professional and direct / Friendly and consultative]"""
        ),
    )
    db.add(default_context)
    db.commit()
    # send_verification_email(user.email, verification_token)
    return {"message": "Account created successfully. You can now log in."}

@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(),
          db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.email == form_data.username.lower().strip()).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated. Contact support.",
        )
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    token = create_access_token({"sub": str(user.user_id)})
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.user_id,
        name=user.name,
        email=user.email,
        is_admin=bool(user.is_admin),
    )

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

@router.post("/login-json", response_model=LoginResponse)
@limiter.limit("5/minute")
def login_json(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.email == body.email.lower().strip()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated. Contact support.",
        )
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    token = create_access_token({"sub": str(user.user_id)})
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.user_id,
        name=user.name,
        email=user.email,
        is_admin=bool(user.is_admin),
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        user_id=current_user.user_id,
        name=current_user.name,
        email=current_user.email,
        is_admin=bool(current_user.is_admin),
    )

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logged out successfully"}

@router.post("/verify-email")
@limiter.limit("3/minute")
def verify_email(request: Request, token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.verification_token == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token.")
    if user.verification_token_expires is None or \
       datetime.now(timezone.utc) > user.verification_token_expires.replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="Verification token has expired.")
    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    return {"message": "Email verified successfully. You can now log in."}

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest,
                    db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.email == body.email.lower().strip()).first()
    if user:
        token = secrets.token_urlsafe(32)
        user.verification_token = token
        user.verification_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        db.commit()
        send_password_reset_email(user.email, token)
    return {"message": "If this email exists, a reset link has been sent."}

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number.")
        return v

@router.post("/reset-password")
@limiter.limit("3/minute")
def reset_password(request: Request, body: ResetPasswordRequest,
                   db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.verification_token == body.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if user.verification_token_expires is None or \
       datetime.now(timezone.utc) > user.verification_token_expires.replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")
    user.password_hash = hash_password(body.password)
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    return {"message": "Password reset successfully"}

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

    @field_validator("new_password")
    @classmethod
    def new_password_strength(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number.")
        return v

@router.put("/update-profile")
def update_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if request.new_password:
        if not request.current_password:
            raise HTTPException(status_code=400,
                detail="Current password required to set new password")
        if not verify_password(request.current_password,
                               current_user.password_hash):
            raise HTTPException(status_code=400,
                detail="Current password is incorrect")
        current_user.password_hash = hash_password(request.new_password)
    if request.name:
        current_user.name = request.name.strip()
    if request.email:
        existing = db.query(User).filter(
            User.email == request.email.lower().strip(),
            User.user_id != current_user.user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400,
                detail="Email already in use")
        current_user.email = request.email.lower().strip()
    db.commit()
    db.refresh(current_user)
    return {"user_id": current_user.user_id,
            "name": current_user.name,
            "email": current_user.email}
