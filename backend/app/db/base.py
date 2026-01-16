# Import Base from session (where declarative_base was defined)
from app.db.session import Base

# Import all models here so Alembic/SQLAlchemy can "see" them
# This solves the "tables not creating" issue
from app.models.user import User
from app.models.user_context import UserContext
from app.models.search_session import SearchSession
from app.models.search_result import SearchResult
from app.models.agent_run import AgentRun
from app.models.agent_output_log import AgentOutputLog
from app.models.dashboard_client import DashboardClient