"""Shared dependencies and helpers for the PowerStats routers.

This module centralizes:

- ``get_db``: a FastAPI dependency that yields a SQLAlchemy session.
- Supabase client + Storage upload helpers backed by environment variables.

No secret values are hardcoded here; everything is read from ``os.environ``.
"""

import os
from typing import BinaryIO, Generator

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

# Import the app-level session factory. ``database.py`` reads the connection
# string from ``SUPABASE_DB_URL`` at import time.
from database import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Yield a SQLAlchemy session and always close it after the request.

    :return: A ``Session`` bound to the configured Supabase Postgres engine.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_supabase_admin_client():
    """Build a Supabase service-role admin client from environment variables.

    Requires ``SUPABASE_URL`` and ``SUPABASE_SERVICE_ROLE_KEY`` to be set.
    The service role key bypasses Row Level Security, so this client must
    only be used server-side (never exposed to the browser).

    :return: A configured ``supabase.Client``.
    :raises RuntimeError: If required environment variables are missing.
    """
    try:
        from supabase import create_client
    except ImportError as exc:  # pragma: no cover - depends on install
        raise RuntimeError(
            "The 'supabase' package is required. Install it with "
            "'pip install supabase'."
        ) from exc

    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment "
            "variables must be set to use Supabase Storage / Auth admin."
        )
    return create_client(supabase_url, service_role_key)


def upload_to_supabase_storage(
    bucket: str,
    file_path: str,
    file: UploadFile,
    allowed_content_types: tuple = ("image/jpeg", "image/png", "image/webp", "image/gif"),
) -> str:
    """Upload a file to a Supabase Storage bucket and return its public URL.

    :param bucket: Storage bucket name (e.g. ``team-logos``).
    :param file_path: Destination path inside the bucket (e.g. ``teams/1/logo.png``).
    :param file: The ``UploadFile`` received by the endpoint.
    :param allowed_content_types: Tuple of allowed MIME types.
    :return: The public URL of the uploaded file.
    :raises HTTPException: If validation fails or the upload errors out.
    """
    content_type = (file.content_type or "").lower()
    if content_type not in allowed_content_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{content_type}'. "
                   f"Allowed types: {', '.join(allowed_content_types)}.",
        )

    bucket_name = os.getenv("SUPABASE_STORAGE_BUCKET", bucket)

    try:
        client = get_supabase_admin_client()
        file_bytes: bytes = file.file.read()
        if not file_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )
        client.storage.from_(bucket_name).upload(
            path=file_path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": True},
        )
        # Build the public URL without requiring a separate signed request.
        supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        public_url = (
            f"{supabase_url}/storage/v1/object/public/{bucket_name}/{file_path}"
        )
        return public_url
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - network / provider errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase Storage upload failed: {str(exc)}",
        ) from exc


def build_file_path(entity: str, entity_id: int, filename: str) -> str:
    """Build a deterministic Storage path for an entity logo/photo.

    :param entity: Entity slug, e.g. ``teams`` or ``players``.
    :param entity_id: Primary key of the entity row.
    :param filename: Original client filename (extension is preserved).
    :return: A storage path like ``teams/42/logo.png``.
    """
    # Strip any path components the client may have sent.
    safe_name = os.path.basename(filename).replace(" ", "_")
    return f"{entity}/{entity_id}/logo_{safe_name}"

