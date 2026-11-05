"""Prints the game's shot list, one "SHOT name" line each (for tools/rerender.sh)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import shots  # noqa: E402

for name in shots.GAME_SHOTS:
    assert name in shots.SHOTS, name
    print(f"SHOT {name}")
