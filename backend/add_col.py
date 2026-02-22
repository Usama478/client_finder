from sqlalchemy import text
from app.db.session import engine

def apply_migration():
    print("Applying migration to add 'is_saved_client' column...")
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE search_results ADD COLUMN is_saved_client BOOLEAN DEFAULT FALSE;"))
            print("Successfully added column.")
        except Exception as e:
            # Check if it already exists or other error
            print("Error executing ALTER TABLE (could already exist):", e)

if __name__ == "__main__":
    apply_migration()
