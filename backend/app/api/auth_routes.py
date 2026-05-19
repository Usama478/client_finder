from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from app.db.session import get_db
from app.models.user import User
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

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
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
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(
        User.email == request.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    verification_token = secrets.token_urlsafe(32)
    verification_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    user = User(
        name=request.name.strip(),
        email=request.email.lower().strip(),
        password_hash=hash_password(request.password),
        is_verified=False,
        is_active=True,
        verification_token=verification_token,
        verification_token_expires=verification_expires,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    initialize_credits(db, user.user_id, 200)
    db.commit()
    send_verification_email(user.email, verification_token)
    return {"message": "Account created. Please check your email to verify your account."}

@router.post("/login", response_model=LoginResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(),
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
    email: str
    password: str

@router.post("/login-json", response_model=LoginResponse)
def login_json(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.email == request.email.lower().strip()).first()
    if not user or not verify_password(request.password, user.password_hash):
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
def verify_email(token: str, db: Session = Depends(get_db)):
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
    email: str

@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest,
                    db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.email == request.email.lower().strip()).first()
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
def reset_password(request: ResetPasswordRequest,
                   db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.verification_token == request.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if user.verification_token_expires is None or \
       datetime.now(timezone.utc) > user.verification_token_expires.replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")
    user.password_hash = hash_password(request.password)
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    return {"message": "Password reset successfully"}

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
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
