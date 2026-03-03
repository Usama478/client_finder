"""Initial schema

Revision ID: 20260303_0001
Revises:
Create Date: 2026-03-03 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260303_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "search_contexts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("prompt_text", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_search_contexts_id"), "search_contexts", ["id"], unique=False)

    op.create_table(
        "users",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_user_id"), "users", ["user_id"], unique=False)

    op.create_table(
        "search_sessions",
        sa.Column("search_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("search_query", sa.String(), nullable=False),
        sa.Column("search_location", sa.String(), nullable=True),
        sa.Column("search_filters", sa.JSON(), nullable=True),
        sa.Column("context_id", sa.Integer(), nullable=True),
        sa.Column("google_api_request_hash", sa.String(), nullable=True),
        sa.Column("next_page_token", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["context_id"], ["search_contexts.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("search_id"),
    )
    op.create_index(
        op.f("ix_search_sessions_google_api_request_hash"),
        "search_sessions",
        ["google_api_request_hash"],
        unique=False,
    )
    op.create_index(op.f("ix_search_sessions_search_id"), "search_sessions", ["search_id"], unique=False)

    op.create_table(
        "user_context",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("company_name", sa.Text(), nullable=False),
        sa.Column("company_description", sa.Text(), nullable=False),
        sa.Column("products_offered", sa.Text(), nullable=False),
        sa.Column("target_markets", sa.Text(), nullable=True),
        sa.Column("target_industries", sa.Text(), nullable=True),
        sa.Column("relevance_rules", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "search_results",
        sa.Column("result_id", sa.Integer(), nullable=False),
        sa.Column("place_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("search_id", sa.Integer(), nullable=False),
        sa.Column("raw_data", sa.JSON(), nullable=False),
        sa.Column("business_name", sa.String(), nullable=False),
        sa.Column("address", sa.String(), nullable=True),
        sa.Column("website", sa.String(), nullable=True),
        sa.Column("phone_number", sa.String(), nullable=True),
        sa.Column("is_saved_client", sa.Boolean(), nullable=True),
        sa.Column("scraping_status", sa.String(), nullable=True),
        sa.Column("scraped_text_content", sa.Text(), nullable=True),
        sa.Column("relevance_status", sa.String(), nullable=True),
        sa.Column("relevance_decision", sa.String(), nullable=True),
        sa.Column("relevance_score", sa.Float(), nullable=True),
        sa.Column("relevance_reason", sa.Text(), nullable=True),
        sa.Column("business_type", sa.String(), nullable=True),
        sa.Column("primary_niche", sa.String(), nullable=True),
        sa.Column("verification_status", sa.String(), nullable=True),
        sa.Column("verification_result", sa.String(), nullable=True),
        sa.Column("verification_reason", sa.Text(), nullable=True),
        sa.Column("verification_score", sa.Integer(), nullable=True),
        sa.Column("risk_flags", sa.JSON(), nullable=True),
        sa.Column("manual_review", sa.Boolean(), nullable=True),
        sa.Column("email_status", sa.String(), nullable=True),
        sa.Column("email_found", sa.String(), nullable=True),
        sa.Column("email_score", sa.Integer(), nullable=True),
        sa.Column("outreach_status", sa.String(), nullable=True),
        sa.Column("email_subject", sa.Text(), nullable=True),
        sa.Column("email_body", sa.Text(), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["search_id"], ["search_sessions.search_id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("result_id"),
    )
    op.create_index(op.f("ix_search_results_place_id"), "search_results", ["place_id"], unique=True)
    op.create_index(op.f("ix_search_results_result_id"), "search_results", ["result_id"], unique=False)

    op.create_table(
        "agent_runs",
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("search_id", sa.Integer(), nullable=False),
        sa.Column("agent_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("last_processed_result_id", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["search_id"], ["search_sessions.search_id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("run_id"),
    )
    op.create_index(op.f("ix_agent_runs_run_id"), "agent_runs", ["run_id"], unique=False)

    op.create_table(
        "agent_output_logs",
        sa.Column("log_id", sa.Integer(), nullable=False),
        sa.Column("agent_type", sa.String(), nullable=False),
        sa.Column("result_id", sa.Integer(), nullable=False),
        sa.Column("input_snapshot", sa.JSON(), nullable=False),
        sa.Column("output_snapshot", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["result_id"], ["search_results.result_id"]),
        sa.PrimaryKeyConstraint("log_id"),
    )
    op.create_index(op.f("ix_agent_output_logs_log_id"), "agent_output_logs", ["log_id"], unique=False)

    op.create_table(
        "dashboard_clients",
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("result_id", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["result_id"], ["search_results.result_id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("client_id"),
    )
    op.create_index(op.f("ix_dashboard_clients_client_id"), "dashboard_clients", ["client_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_dashboard_clients_client_id"), table_name="dashboard_clients")
    op.drop_table("dashboard_clients")

    op.drop_index(op.f("ix_agent_output_logs_log_id"), table_name="agent_output_logs")
    op.drop_table("agent_output_logs")

    op.drop_index(op.f("ix_agent_runs_run_id"), table_name="agent_runs")
    op.drop_table("agent_runs")

    op.drop_index(op.f("ix_search_results_result_id"), table_name="search_results")
    op.drop_index(op.f("ix_search_results_place_id"), table_name="search_results")
    op.drop_table("search_results")

    op.drop_table("user_context")

    op.drop_index(op.f("ix_search_sessions_search_id"), table_name="search_sessions")
    op.drop_index(op.f("ix_search_sessions_google_api_request_hash"), table_name="search_sessions")
    op.drop_table("search_sessions")

    op.drop_index(op.f("ix_users_user_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    op.drop_index(op.f("ix_search_contexts_id"), table_name="search_contexts")
    op.drop_table("search_contexts")
