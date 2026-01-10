from fastapi import FastAPI
from app.db.session import engine, Base
from app.models.test_model import TestItem

app = FastAPI(title="Client Finder MVP")

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/test-db")
def test_db():
    from app.db.session import SessionLocal

    db = SessionLocal()
    item = TestItem(name="DB is working")
    db.add(item)
    db.commit()
    db.refresh(item)
    db.close()

    return {"id": item.id, "name": item.name}
