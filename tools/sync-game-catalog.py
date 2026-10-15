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
                if int(key) < 642},
}
# Current Repentance+ enum names from REPENTOGON resources/scripts/enums_ex.lua.
plus_names = ["UNKNOWN_EVENT_496", "ONLINE_CURRENT_STREAK", "ONLINE_BEST_STREAK", "ONLINE_NEGATIVE_STREAK",
    "ONLINE_SIN_ETERNAL", "ONLINE_SIN_HEARTLESS", "ONLINE_SIN_ENVIOUS", "ONLINE_SIN_DRESSED_UP", "ONLINE_SIN_PRIDEFUL", "ONLINE_SIN_SAVIOR", "ONLINE_SIN_WRATHFUL", "ONLINE_SIN_BIG_BOSS", "ONLINE_SIN_EXPLORER", "ONLINE_SIN_EXPRESSIVE", "ONLINE_SIN_GLUTTONOUS", "ONLINE_SIN_RECKLESS", "ONLINE_SIN_ESCAPE_ARTIST", "ONLINE_SIN_GAMBLER", "ONLINE_SIN_GREEDY", "ONLINE_SIN_MYSTIC", "ONLINE_SIN_PILL_POPPER", "ONLINE_SIN_BIG_SPENDER", "ONLINE_SIN_JANITOR", "ONLINE_SIN_LUSTFUL", "ONLINE_SIN_SLOTHFUL", "DAILYS_BEST_STREAK", "DAILYS_NEGATIVE_STREAK"]
for offset, name in enumerate(plus_names, 496):
    output["eventCounters"][str(offset)] = {"name": name, "aliases": [name]}
# The original generic reference omits this visible item; verified in the pinned collection profile.
required = json.loads((ROOT / "site/data/dead-god-collection.json").read_text())["requiredItems"]
known_ids = {item["id"] for item in output["items"]}
output["items"].extend(item for item in required if item["id"] not in known_ids)

target = ROOT / "site/data/game-catalog.json"
target.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n")
print(f"Wrote {target}")
