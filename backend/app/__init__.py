# ProxyProof Backend Application Package
import sys
from pathlib import Path

# Ensure repository root and backend directory are always on sys.path
_current_dir = Path(__file__).resolve().parent
_backend_dir = _current_dir.parent
_repo_root = _backend_dir.parent

for _p in [str(_repo_root), str(_backend_dir)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)
