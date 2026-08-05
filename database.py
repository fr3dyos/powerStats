from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load environment variables from the `.env` file (if present). This is what
# makes `DATABASE_URL` / `SUPABASE_*` available to `os.getenv` below when
# running locally without exporting them into the shell.
load_dotenv()

# Get database URL from environment variable. Prefer DATABASE_URL (the name
# used in .env.example / README); fall back to SUPABASE_DB_URL for backward
# compatibility with earlier generated code.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")

if not SQLALCHEMY_DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL (or SUPABASE_DB_URL) environment variable is not set. "
        "Copy .env.example to .env and fill in your Supabase Postgres "
        "connection string."
    )

# Create SQLAlchemy engine
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for declarative models
Base = declarative_base()
