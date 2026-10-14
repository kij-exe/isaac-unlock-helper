#!/usr/bin/env python3
"""Refresh the frontend's generic labels from the offline research catalog."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / "data/catalog.json").read_text())
output = {
    "schemaVersion": 1,
    "characters": [{"name": entry["name"], "rosterIndex": entry["roster_index"]}
                   for entry in catalog["characters"]],
    "eventCounters": catalog["event_counters"],
    "bosses": catalog["bosses"],
    "challenges": {key: {"name": entry["name"]} for key, entry in catalog["challenges"].items()},
    "items": [{"id": entry["item_id"], "name": entry["name"]}
              for entry in catalog["items"] if entry["kind"] in ("active", "passive")],
    "entities": catalog["entities"],
    "secrets": {key: {"name": entry["name"]} for key, entry in catalog["achievements"].items()
                if int(key) < 638},
}
target = ROOT / "site/data/game-catalog.json"
target.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n")
print(f"Wrote {target}")
