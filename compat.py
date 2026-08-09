"""supabase-py 2.5.x compatibility shim.

Modern Supabase projects expose two key formats:
- **Legacy JWT** keys: ``eyJhbGciOi...`` (the ``anon`` and ``service_role`` keys)
- **New-format** keys: ``sb_publishable_...`` and ``sb_secret_...``

supabase-py ≤ 2.5.3 validates the key against a JWT regex before constructing
the HTTP client. The new-format keys are valid at the Supabase gateway level
(verified via direct HTTP calls) but fail the Python-side regex check, raising
``SupabaseException("Invalid API key")``.

This module monkey-patches ``SyncClient.__init__`` to also accept ``sb_*``
keys so that the existing ``.env`` (which uses new-format keys) works without
changing secrets.  Import this module **once** at application startup (from
``main.py``) before any ``create_client()`` calls.
"""

from __future__ import annotations

import re
from typing import Any, Callable

# The exact JWT regex string validated in supabase._sync.client.SyncClient.__init__.
# We compare against the *string* because the SDK calls ``re.match(pattern, key)``
# with a raw string pattern, not a precompiled pattern object.
_JWT_REGEX = r"^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$"


def _patch_supabase_client() -> None:
    """Allow ``sb_*`` keys by relaxing the JWT regex in ``SyncClient.__init__``."""
    try:
        from supabase._sync.client import SyncClient
    except ImportError:
        return  # supabase-py not installed; nothing to patch.

    _original_init: Callable[..., None] = SyncClient.__init__

    def _patched_init(
        self: Any,
        supabase_url: str,
        supabase_key: str,
        options: Any = None,
    ) -> None:
        # If the key looks like a ``sb_*`` format key, temporarily swap the
        # module-level ``re.match`` so the JWT regex always matches.
        if isinstance(supabase_key, str) and supabase_key.startswith("sb_"):
            _real_match = re.match

            def _permissive_match(pat: Any, s: Any, *a: Any, **kw: Any) -> Any:
                if pat == _JWT_REGEX:
                    return True
                return _real_match(pat, s, *a, **kw)

            re.match = _permissive_match  # type: ignore[assignment]
            try:
                _original_init(self, supabase_url, supabase_key, options)
            finally:
                re.match = _real_match  # type: ignore[assignment]
        else:
            _original_init(self, supabase_url, supabase_key, options)

    SyncClient.__init__ = _patched_init  # type: ignore[assignment]


# Apply on import so ``main.py`` only needs ``import compat``.
_patch_supabase_client()
