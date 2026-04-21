from sqlalchemy.orm import Session
from typing import Optional, List
from app.models.activity_log import ActivityLog

def log_activity(db: Session, user_id: int, action_type: str,
                 metadata: Optional[dict] = None,
                 ip_address: Optional[str] = None,
                 session_id: Optional[int] = None,
                 business_id: Optional[int] = None,
                 credits_consumed: int = 0,
                 cost_estimate_usd: Optional[float] = None) -> None:
    entry = ActivityLog(
        user_id=user_id, action_type=action_type,
        metadata_=metadata, ip_address=ip_address,
        session_id=session_id, business_id=business_id,
        credits_consumed=credits_consumed,
        cost_estimate_usd=cost_estimate_usd)
    db.add(entry)

def get_recent_activities(db: Session, limit: int = 50,
                          user_id: Optional[int] = None) -> List[ActivityLog]:
    q = db.query(ActivityLog)
    if user_id:
        q = q.filter(ActivityLog.user_id == user_id)
    return q.order_by(ActivityLog.timestamp.desc()).limit(limit).all()
