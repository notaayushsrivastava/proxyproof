# ProxyProof Backend Package
import sys
from pathlib import Path

# Ensure repository root is on sys.path
_backend_dir = Path(__file__).resolve().parent
_repo_root = _backend_dir.parent

if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))
