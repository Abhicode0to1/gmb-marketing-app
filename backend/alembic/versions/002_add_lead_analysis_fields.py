"""add lead analysis fields

Revision ID: 002
Revises: 001
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("website_status", sa.String(20), nullable=True))
    op.add_column("leads", sa.Column("service_needs", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("leads", sa.Column("has_corporate_email", sa.Boolean(), nullable=True))
    op.create_index("ix_leads_website_status", "leads", ["website_status"])

    # Back-fill existing leads based on has_website + website columns
    op.execute("""
        UPDATE leads SET
            website_status = 'none',
            service_needs = '["new_website","corporate_email"]'::jsonb,
            has_corporate_email = false
        WHERE has_website = false AND website IS NULL
    """)
    op.execute("""
        UPDATE leads SET
            website_status = 'social_only',
            service_needs = '["new_website","corporate_email"]'::jsonb,
            has_corporate_email = false
        WHERE has_website = false AND website IS NOT NULL
    """)
    op.execute("""
        UPDATE leads SET
            website_status = 'alive',
            service_needs = '[]'::jsonb
        WHERE has_website = true
    """)


def downgrade() -> None:
    op.drop_index("ix_leads_website_status", table_name="leads")
    op.drop_column("leads", "has_corporate_email")
    op.drop_column("leads", "service_needs")
    op.drop_column("leads", "website_status")
