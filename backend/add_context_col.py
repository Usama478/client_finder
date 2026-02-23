from sqlalchemy import text
from app.db.session import engine

def apply_migration():
    print("Applying migration to add 'context_id' column to 'search_sessions'...")
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE search_sessions ADD COLUMN context_id INTEGER REFERENCES search_contexts(id);"))
            print("Successfully added column.")
        except Exception as e:
            # Check if it already exists or other error
            print("Error executing ALTER TABLE (could already exist):", e)

if __name__ == "__main__":
    apply_migration()
