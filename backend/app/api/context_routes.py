from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from app.db.session import get_db
from app.models.search_context import SearchContext
from app.core.security import get_current_user

router = APIRouter(prefix="/api/v1", tags=["contexts"])

class ContextCreate(BaseModel):
    name: str
    prompt_text: str

class ContextResponse(BaseModel):
    id: int
    name: str
    prompt_text: str

    class Config:
        from_attributes = True

@router.get("/contexts", response_model=List[ContextResponse])
def get_all_contexts(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Fetch all saved context templates."""
    try:
        contexts = db.query(SearchContext).filter(SearchContext.user_id == current_user.user_id).order_by(SearchContext.id.asc()).all()
        return contexts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/contexts", response_model=ContextResponse)
def create_context(payload: ContextCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Create a new search context template."""
    try:
        new_context = SearchContext(
            user_id=current_user.user_id,
            name=payload.name,
            prompt_text=payload.prompt_text
        )
        db.add(new_context)
        db.commit()
        db.refresh(new_context)
        return new_context
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/contexts/{context_id}")
def delete_context(context_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ctx = db.query(SearchContext).filter(SearchContext.id == context_id, SearchContext.user_id == current_user.user_id).first()
    if not ctx:
        raise HTTPException(status_code=404, detail="Context not found")
    db.delete(ctx)
    db.commit()
    return {"ok": True}

@router.put("/contexts/{context_id}", response_model=ContextResponse)
def update_context(context_id: int, payload: ContextCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ctx = db.query(SearchContext).filter(SearchContext.id == context_id, SearchContext.user_id == current_user.user_id).first()
    if not ctx:
        raise HTTPException(status_code=404, detail="Context not found")
    ctx.name = payload.name
    ctx.prompt_text = payload.prompt_text
    db.commit()
    db.refresh(ctx)
    return ctx
