#!/usr/bin/env python3
"""Build a pinned, offline reference catalog. Never executes downloaded JavaScript."""

import argparse
import ast
import hashlib
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
REPENTOGON_REF = "9833f482100d6a62896831d2c744d1efe710d7f1"
TRACKER_URL = "https://deadgod.yeeterie.org/assets/data-d8ce3ab0.js"
TRACKER_SHA256 = "7fb96ebe12ba4c853cfefbd58ed536ccfb6450a0c75fcdff18b24c75d7062d29"


class LiteralReader:
    """Read only JS data literals: no functions, expressions, imports, or eval."""

    def __init__(self, source, offset):
        self.source = source
        self.offset = offset

    def value(self):
        s = self.source
        while self.offset < len(s) and s[self.offset].isspace():
            self.offset += 1
        ch = s[self.offset]
        if ch == '"':
            value, end = json.JSONDecoder().raw_decode(s, self.offset)
            self.offset = end
            return value
        if ch == "'":
            match = re.match(r"'(?:\\.|[^'\\])*'", s[self.offset:])
            if not match:
                raise ValueError("Unterminated string")
            self.offset += len(match[0])
            return ast.literal_eval(match[0])
        if ch in "[{":
            is_object = ch == "{"
            closing = "}" if is_object else "]"
            self.offset += 1
            result = {} if is_object else []
            while s[self.offset] != closing:
                if is_object:
                    if s[self.offset] in ('"', "'"):
                        key = self.value()
                    else:
                        match = re.match(r"[A-Za-z_$][\w$]*|\d+", s[self.offset:])
                        if not match:
                            raise ValueError(f"Invalid object key at {self.offset}")
                        key = match[0]
                        self.offset += len(key)
                    if s[self.offset] != ":":
                        raise ValueError("Expected ':'")
                    self.offset += 1
                    if key in result:
                        raise ValueError(f"Duplicate key: {key}")
                    result[key] = self.value()
                else:
                    result.append(self.value())
                if s[self.offset] == closing:
                    break
                if s[self.offset] != ",":
                    raise ValueError(f"Expected ',' at {self.offset}")
                self.offset += 1
            self.offset += 1
            return result
        for token, value in (("!0", True), ("!1", False), ("null", None)):
            if s.startswith(token, self.offset):
                self.offset += len(token)
                return value
        match = re.match(r"-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?", s[self.offset:])
        if not match:
            raise ValueError(f"Not a supported data literal at {self.offset}")
        self.offset += len(match[0])
        token = match[0]
        return float(token) if any(c in token for c in ".eE") else int(token)


def assignment(source, name):
    match = re.search(r"(?:const |,)" + re.escape(name) + r"=([\[{])", source)
    if not match:
        raise ValueError(f"Cannot find pinned catalog variable {name}")
    return LiteralReader(source, match.end() - 1).value()


def enum_rows(source):
    result = {}
    for line in source.splitlines():
        match = re.match(r"\|\s*(\d+)\s*\|([^|{]+)", line)
        if match:
            key, name = match[1], match[2].strip()
            result.setdefault(key, {"name": name, "aliases": []})
            result[key]["aliases"].append(name)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, help="Read the research snapshots locally")
    args = parser.parse_args()
    sources = []

    def read(name, url, expected_hash=None):
        if args.cache:
            data = (args.cache / name).read_bytes()
        else:
            request = Request(url, headers={"User-Agent": "isaac-unlock-helper/0.1"})
            with urlopen(request, timeout=30) as response:
                data = response.read()
        digest = hashlib.sha256(data).hexdigest()
        if expected_hash and digest != expected_hash:
            raise ValueError(f"Source snapshot changed: {url}")
        sources.append({"url": url, "sha256": digest})
        return data.decode("utf-8")

    base = f"https://raw.githubusercontent.com/TeamREPENTOGON/REPENTOGON/{REPENTOGON_REF}"
    counters = enum_rows(read("EventCounter.md", base + "/docs/docs/enums/EventCounter.md"))
    bosses = enum_rows(read("BossType.md", base + "/docs/docs/enums/BossType.md"))
    tracker = read("deadgod_data.js", TRACKER_URL, TRACKER_SHA256)
    achievements = assignment(tracker, "v")
    characters = assignment(tracker, "x")
    items = assignment(tracker, "W")
    entities = assignment(tracker, "a")
    challenge_rewards = assignment(tracker, "B")
    challenges = {}
    for key, reward in challenge_rewards.items():
        if not 1 <= int(key) <= 45:
            continue
        challenges[key] = {
            "name": reward["wikiPath"].removeprefix("/wiki/").replace("_", " "),
            "reward": reward["reward"],
            "achievement_id": reward["achievementId"],
        }
    # The tracker includes Wiki paths with URL escapes in their names.
    from urllib.parse import unquote
    for challenge in challenges.values():
        challenge["name"] = unquote(challenge["name"])
    catalog = {
        "schema": 1,
        "sources": sources,
        "note": "Game identifiers and community lookup data; not extracted from the user's installation.",
        "event_counters": counters,
        "bosses": bosses,
        "achievements": {
            key: {"name": val["name"], "condition": val["unlockDescription"]}
            for key, val in achievements.items()
        },
        "characters": [
            {"roster_index": index,
             "name": (char["name"] if index < 17 else "Tainted Jacob" if index == 33
                      else "Tainted " + characters[index - 17]["name"]),
             "tainted": char["tainted"], "unlockAchId": char["unlockAchId"]}
            for index, char in enumerate(characters)
        ],
        "items": [
            {key: item[key] for key in (
                "item_id", "name", "kind", "requires_unlock", "achievement_id", "unlock_condition"
            )}
            for item in items
        ],
        "entities": entities,
        "challenges": challenges,
    }
    assert len(catalog["characters"]) == 34
    assert len(challenges) == 45
    assert all(str(i) in achievements for i in range(1, 638))
    output = ROOT / "data" / "catalog.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output}: {len(items)} entries, {len(entities)} enemies")


if __name__ == "__main__":
    main()
