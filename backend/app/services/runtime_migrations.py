import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


logger = logging.getLogger(__name__)


def _column_names(inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _column_type_name(inspector, table_name: str, column_name: str) -> str:
    for column in inspector.get_columns(table_name):
        if column["name"] == column_name:
            return str(column["type"]).upper()
    return ""


def ensure_runtime_schema(engine: Engine) -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "users" not in table_names:
        return

    user_columns = _column_names(inspector, "users")

    with engine.begin() as connection:
        if "display_name" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN display_name VARCHAR(80)"))
            logger.info("Added users.display_name column")

        if "account_type" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN account_type VARCHAR(20) NOT NULL DEFAULT 'member'"))
            logger.info("Added users.account_type column")

        if "monthly_post_limit_per_stance" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN monthly_post_limit_per_stance INTEGER NOT NULL DEFAULT 1"))
            logger.info("Added users.monthly_post_limit_per_stance column")

        connection.execute(text(
            "UPDATE users SET account_type = 'member' "
            "WHERE account_type IS NULL OR TRIM(account_type) = ''"
        ))
        connection.execute(text(
            "UPDATE users SET monthly_post_limit_per_stance = 1 "
            "WHERE monthly_post_limit_per_stance IS NULL OR monthly_post_limit_per_stance < 1"
        ))

        if "agent_api_keys" not in table_names:
            connection.execute(text(
                "CREATE TABLE agent_api_keys ("
                "id INTEGER PRIMARY KEY, "
                "user_id INTEGER NOT NULL, "
                "label VARCHAR(80) NOT NULL, "
                "key_hash VARCHAR(64) NOT NULL UNIQUE, "
                "last_used_at DATETIME NULL, "
                "revoked_at DATETIME NULL, "
                "is_active BOOLEAN NOT NULL DEFAULT 1, "
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
                "FOREIGN KEY(user_id) REFERENCES users (id)"
                ")"
            ))
            connection.execute(text("CREATE INDEX ix_agent_api_keys_user_id ON agent_api_keys (user_id)"))
            connection.execute(text("CREATE INDEX ix_agent_api_keys_key_hash ON agent_api_keys (key_hash)"))
            logger.info("Created agent_api_keys table")

        if "bear_vs_bull_posts" in table_names:
            post_columns = _column_names(inspector, "bear_vs_bull_posts")

            if "source_type" not in post_columns:
                connection.execute(text("ALTER TABLE bear_vs_bull_posts ADD COLUMN source_type VARCHAR(40)"))
                logger.info("Added bear_vs_bull_posts.source_type column")

            if "source_name" not in post_columns:
                connection.execute(text("ALTER TABLE bear_vs_bull_posts ADD COLUMN source_name VARCHAR(80)"))
                logger.info("Added bear_vs_bull_posts.source_name column")

            if "source_url" not in post_columns:
                connection.execute(text("ALTER TABLE bear_vs_bull_posts ADD COLUMN source_url TEXT"))
                logger.info("Added bear_vs_bull_posts.source_url column")

            if "source_published_at" not in post_columns:
                source_published_at_column_type = (
                    "TIMESTAMP WITH TIME ZONE"
                    if engine.dialect.name == "postgresql"
                    else "DATETIME"
                )
                connection.execute(text(
                    f"ALTER TABLE bear_vs_bull_posts ADD COLUMN source_published_at {source_published_at_column_type}"
                ))
                logger.info("Added bear_vs_bull_posts.source_published_at column")
            else:
                source_published_at_type = _column_type_name(inspector, "bear_vs_bull_posts", "source_published_at")
                if engine.dialect.name == "postgresql" and "DATE" in source_published_at_type and "TIME" not in source_published_at_type:
                    connection.execute(text(
                        "ALTER TABLE bear_vs_bull_posts "
                        "ALTER COLUMN source_published_at TYPE TIMESTAMP WITH TIME ZONE "
                        "USING CASE "
                        "WHEN source_published_at IS NULL THEN NULL "
                        "ELSE source_published_at::timestamp AT TIME ZONE 'UTC' "
                        "END"
                    ))
                    logger.info("Converted bear_vs_bull_posts.source_published_at to timestamptz")

            if "external_id" not in post_columns:
                connection.execute(text("ALTER TABLE bear_vs_bull_posts ADD COLUMN external_id VARCHAR(120)"))
                logger.info("Added bear_vs_bull_posts.external_id column")

            if "created_via" not in post_columns:
                connection.execute(text("ALTER TABLE bear_vs_bull_posts ADD COLUMN created_via VARCHAR(20) NOT NULL DEFAULT 'member'"))
                logger.info("Added bear_vs_bull_posts.created_via column")

            connection.execute(text(
                "UPDATE bear_vs_bull_posts SET created_via = 'agent' "
                "WHERE user_id IN (SELECT id FROM users WHERE account_type = 'agent')"
            ))
            connection.execute(text(
                "UPDATE bear_vs_bull_posts SET created_via = 'member' "
                "WHERE created_via IS NULL OR TRIM(created_via) = ''"
            ))

            existing_indexes = {index["name"] for index in inspector.get_indexes("bear_vs_bull_posts")}
            if "ix_bear_vs_bull_posts_external_id" not in existing_indexes:
                connection.execute(text("CREATE INDEX ix_bear_vs_bull_posts_external_id ON bear_vs_bull_posts (external_id)"))
            if "ix_bear_vs_bull_posts_created_via" not in existing_indexes:
                connection.execute(text("CREATE INDEX ix_bear_vs_bull_posts_created_via ON bear_vs_bull_posts (created_via)"))
            if "ix_bear_vs_bull_posts_source_type" not in existing_indexes:
                connection.execute(text("CREATE INDEX ix_bear_vs_bull_posts_source_type ON bear_vs_bull_posts (source_type)"))
