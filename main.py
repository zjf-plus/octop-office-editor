"""Office / PDF viewer and editor — frontend-only plugin.

Everything runs in the browser: ``ui/dist/index.js`` registers file viewers,
and ``public/editor/`` holds the offline ONLYOFFICE bundle served without auth
by Octop's ``/api/plugin-public/<id>/`` route. No backend tools are needed.
"""

from __future__ import annotations

from typing import Any


def setup(ctx: Any) -> None:
    """Nothing to register on the backend."""
    del ctx
