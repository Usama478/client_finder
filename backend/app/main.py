from fastapi import FastAPI

app = FastAPI(title="Client Finder MVP")

@app.get("/health")
def health_check():
    return {"status": "ok"}
