import sys
from pathlib import Path

# Ensure root and backend directory are on sys.path
_current_file = Path(__file__).resolve()
_root = _current_file.parent.parent
_backend = _root / "backend"

for p in [str(_root), str(_backend)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.app.main import app

# Export ASGI app for Vercel Serverless Function
handler = app
