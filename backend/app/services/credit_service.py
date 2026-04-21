from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.user_credit import UserCredit
from app.models.credit_transaction import CreditTransaction
from typing import Optional

CREDIT_COSTS = {
    "search_session": 10,
    "relevancy": 1,
    "verification": 2,
    "export": 5,
}

def initialize_credits(db: Session, user_id: int, amount: int = 200) -> UserCredit:
    credit = UserCredit(user_id=user_id, credits_remaining=amount,
                        credits_used_total=0, allocated_total=amount)
    db.add(credit)
    db.flush()
    return credit

def get_balance(db: Session, user_id: int) -> int:
    credit = db.query(UserCredit).filter(UserCredit.user_id == user_id).first()
    return credit.credits_remaining if credit else 0

def check_credits(db: Session, user_id: int, required: int) -> None:
    balance = get_balance(db, user_id)
    if balance < required:
        raise HTTPException(status_code=402,
            detail=f"Insufficient credits. Required: {required}, Available: {balance}")

def deduct_credits(db: Session, user_id: int, amount: int, action_type: str,
                   reference_id: Optional[str] = None,
                   reference_type: Optional[str] = None,
                   cost_estimate_usd: Optional[float] = None) -> int:
    sp = db.begin_nested()
    try:
        credit = db.query(UserCredit).filter(
            UserCredit.user_id == user_id).with_for_update().first()
        if not credit:
            raise HTTPException(status_code=404, detail="Credit account not found")
        credit.credits_remaining -= amount
        credit.credits_used_total += amount
        new_balance = credit.credits_remaining
        txn = CreditTransaction(
            user_id=user_id, action_type=action_type,
            credits_delta=-amount, credits_after=new_balance,
            reference_id=reference_id, reference_type=reference_type,
            cost_estimate_usd=cost_estimate_usd)
        db.add(txn)
        sp.commit()
        return new_balance
    except HTTPException:
        sp.rollback()
        raise
    except Exception as e:
        sp.rollback()
        raise HTTPException(status_code=500, detail=f"Credit deduction failed: {e}")

def add_credits(db: Session, user_id: int, amount: int, reason: str = "admin_topup") -> int:
    sp = db.begin_nested()
    try:
        credit = db.query(UserCredit).filter(
            UserCredit.user_id == user_id).with_for_update().first()
        if not credit:
            raise HTTPException(status_code=404, detail="Credit account not found")
        credit.credits_remaining += amount
        credit.allocated_total += amount
        new_balance = credit.credits_remaining
        txn = CreditTransaction(
            user_id=user_id, action_type=reason,
            credits_delta=amount, credits_after=new_balance)
        db.add(txn)
        sp.commit()
        return new_balance
    except HTTPException:
        sp.rollback()
        raise
    except Exception as e:
        sp.rollback()
        raise HTTPException(status_code=500, detail=f"Credit add failed: {e}")

def set_credits(db: Session, user_id: int, amount: int) -> int:
    sp = db.begin_nested()
    try:
        credit = db.query(UserCredit).filter(
            UserCredit.user_id == user_id).with_for_update().first()
        if not credit:
            raise HTTPException(status_code=404, detail="Credit account not found")
        delta = amount - credit.credits_remaining
        credit.credits_remaining = amount
        new_balance = amount
        txn = CreditTransaction(
            user_id=user_id, action_type="admin_set",
            credits_delta=delta, credits_after=new_balance)
        db.add(txn)
        sp.commit()
        return new_balance
    except HTTPException:
        sp.rollback()
        raise
    except Exception as e:
        sp.rollback()
        raise HTTPException(status_code=500, detail=f"Credit set failed: {e}")
