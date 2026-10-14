#!/usr/bin/env python3
"""Package real Isaac sprites locally; no runtime CDN requests are needed.

Usage: python3 tools/fetch_icons.py [--catalog site/data/unlocks.json]
Requires Pillow for decoding, validation and lossless atlas extraction.
Only fetches public static resources with HTTP GET; never touches save files.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from io import BytesIO
import json
from html import escape
from xml.etree import ElementTree
from pathlib import Path
import re
import urllib.parse
import urllib.request

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEADGOD = "https://deadgod.yeeterie.org"
ARDOR = "https://isaac.ardor.guru"
ATLAS_DATA = DEADGOD + "/assets/data-d8ce3ab0.js"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
HEADERS = {"User-Agent": "Mozilla/5.0 (IsaacUnlockHelper asset packager)",
           "Referer": DEADGOD + "/"}


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers=HEADERS, method="GET")
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def decode_image(raw: bytes) -> Image.Image:
    # A successful response can still be an HTML challenge or an SPA fallback.
    is_webp = raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"
    if not (raw.startswith(PNG_MAGIC) or is_webp):
        raise ValueError("Response is neither PNG nor WebP")
    with Image.open(BytesIO(raw)) as check:
        check.verify()
    with Image.open(BytesIO(raw)) as decoded:
        decoded.load()
        return decoded.convert("RGBA")


def atlas_metadata(source: str, prefix: str) -> dict[str, dict[str, int]]:
    pattern = re.compile(
        r'(?P<key>' + re.escape(prefix) + r'[^:{,\"]*)'
        r':\{x:(?P<x>\d+),y:(?P<y>\d+),size:(?P<size>\d+),'
        r'sheetW:(?P<sheetW>\d+),sheetH:(?P<sheetH>\d+)\}')
    return {match["key"]: {name: int(match[name])
                           for name in ("x", "y", "size", "sheetW", "sheetH")}
            for match in pattern.finditer(source)}


def character_filename(node: dict) -> str:
    slug = node["id"].split(":", 1)[-1]
    names = {"blue-baby": "Blue Baby", "lost": "The Lost",
             "forgotten": "The Forgotten", "jacob-esau": "Jacob & Esau",
             "tainted-blue-baby": "Tainted Blue Baby",
             "tainted-lost": "Tainted Lost", "tainted-forgotten": "Tainted Forgotten",
             "tainted-jacob": "Tainted Jacob"}
    name = names.get(slug, slug.replace("-", " ").title())
    return name.replace(" & ", "_and_").replace(" ", "_") + ".png"



def designed_svg(node: dict) -> str:
    """Original vector illustrations, deliberately distinct from game sprites."""
    label = escape(node["name"])
    slug = node["id"].split(":", 1)[1]
    paper = '<path d="M15 8h28l7 8v37H15z" fill="#f3e8d3"/><path d="M42 8v10h8M21 22h15M21 27h20" fill="none" stroke="#8e705b" stroke-width="2.5" stroke-linecap="round"/>'
    if node["kind"] == "challenge":
        number = node["id"].split(":")[1]
        body = paper + f'<text x="32" y="46" text-anchor="middle" fill="#5c423b" font-family="sans-serif" font-weight="800" font-size="19">{number}</text>'
    else:
        # Route symbols communicate their location, without impersonating item art.
        shapes = {
            "cathedral": '<path d="M12 54V26l20-17 20 17v28z" fill="#e5dff5"/><path d="M29 14h6v9h7v5h-7v10h-6V28h-7v-5h7z" fill="#9b87ba"/><path d="M27 54V42a5 5 0 0 1 10 0v12" fill="#9b87ba"/>',
            "sheol": '<path d="M10 53 16 24l11 9 5-25 8 24 9-9 6 30z" fill="#b15d65"/><path d="m24 52 8-20 9 20z" fill="#efb480"/>',
            "chest": '<path d="M10 29h44v24H10z" fill="#cfa76c"/><path d="M10 29v-6a22 15 0 0 1 44 0v6z" fill="#e8ca8f"/><path d="M10 30h44M20 16v37M44 16v37" stroke="#977052" stroke-width="3" fill="none"/><path d="M28 27h8v11h-8z" fill="#fff1bb"/>',
            "dark-room": '<path d="M11 54V17l21-9 21 9v37z" fill="#6c6287"/><path d="M21 54V25h22v29" fill="#312e46"/><path d="m27 36 10 10m0-10L27 46" stroke="#b6a6d6" stroke-width="3"/>',
            "void": '<ellipse cx="32" cy="32" rx="22" ry="18" fill="#716594"/><ellipse cx="32" cy="32" rx="16" ry="13" fill="#4b426a"/><ellipse cx="32" cy="32" rx="10" ry="8" fill="#242336"/><path d="m13 12 3 5m35 29 3 6M48 13l-4 4" stroke="#b9a4d5" stroke-width="3" stroke-linecap="round"/>',
            "corpse": '<path d="M11 52V26Q11 10 32 10t21 16v26z" fill="#a6b39a"/><path d="M21 31q5-9 9 0m5 0q5-9 9 0" stroke="#576959" stroke-width="4" fill="none"/><path d="M22 45h20m-15-4v8m10-8v8" stroke="#576959" stroke-width="3"/>',
            "home": '<path d="m8 29 24-21 24 21-5 5-4-4v24H17V30l-4 4z" fill="#c88b80"/><path d="M27 54V36h11v18" fill="#f1d0af"/><path d="M21 26h9v8h-9" fill="#f1d0af"/>',
            "mega-satan": '<path d="m16 27-5-17 15 8h12l15-8-5 17 4 11-9 15H21l-9-15z" fill="#a3646c"/><path d="m20 29 8 4m16-4-8 4" stroke="#f2c3a3" stroke-width="4"/><path d="M25 43h14" stroke="#593e50" stroke-width="4"/>',
            "greed": '<circle cx="32" cy="32" r="24" fill="#e3bb69"/><circle cx="32" cy="32" r="18" fill="none" stroke="#af8449" stroke-width="3"/><path d="M25 24h14M32 18v28M25 40h14" stroke="#9b743e" stroke-width="4" stroke-linecap="round"/>',
        }
        body = shapes.get(slug, '<path d="M16 54V11h32v43z" fill="#b5a4c8"/><path d="M23 54V19h18v35" fill="#4e435e"/><circle cx="37" cy="36" r="2" fill="#e9cf9c"/><path d="M11 54h42" stroke="#8f7caa" stroke-width="3"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><title>{label}</title>{body}</svg>\n'


def existing_valid(row: dict | None, output: Path) -> bool:
    if not row or row.get("status") not in ("downloaded", "designed") or not row.get("path"):
        return False
    path = output / Path(row["path"]).name
    if not path.is_file():
        return False
    raw = path.read_bytes()
    if sha256(raw).hexdigest() != row.get("sha256"):
        return False
    if row["status"] == "downloaded":
        try:
            return bool(decode_image(raw).getbbox())
        except Exception:
            return False
    try:
        return ElementTree.fromstring(raw).tag == "{http://www.w3.org/2000/svg}svg"
    except ElementTree.ParseError:
        return False

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=ROOT / "site/data/unlocks.json")
    parser.add_argument("--output", type=Path, default=ROOT / "site/assets/icons")
    parser.add_argument("--refresh", action="store_true", help="Refetch valid packaged sprites as well")
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text())
    raw_nodes = catalog["nodes"]
    nodes = list(raw_nodes.values()) if isinstance(raw_nodes, dict) else raw_nodes
    args.output.mkdir(parents=True, exist_ok=True)

    manifest_path = args.output / "manifest.json"
    previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    existing = {row["nodeId"]: row for row in previous.get("icons", [])}
    overrides = json.loads((ROOT / "tools/icon-overrides.json").read_text())
    atlas_needed = any(node["id"].split(":", 1)[0] in ("trinket", "consumable") and
                       (args.refresh or not existing_valid(existing.get(node["id"]), args.output))
                       for node in nodes)
    atlases = {}
    atlas_error = None
    atlas_digest = previous.get("atlasMetadataSha256")
    if atlas_needed:
        try:
            atlas_source = fetch(ATLAS_DATA)
            atlas_digest = sha256(atlas_source).hexdigest()
            atlas_text = atlas_source.decode("utf-8")
            for kind, prefix in (("trinket", "trinket_"), ("consumable", "consumable_")):
                sheet_url = DEADGOD + f"/sprites/{kind}_sheet.webp"
                sheet_raw = fetch(sheet_url)
                atlases[kind] = (decode_image(sheet_raw), atlas_metadata(atlas_text, prefix),
                                 sheet_url, sha256(sheet_raw).hexdigest())
        except Exception as error:
            atlas_error = error

    def package(node: dict) -> dict:
        node_id = node["id"]
        kind = node_id.split(":", 1)[0]
        item_id = node.get("catalog", {}).get("itemId")
        result = {"nodeId": node_id}
        old = existing.get(node_id)
        valid_old = existing_valid(old, args.output)
        if valid_old and not args.refresh:
            return old
        try:
            if kind == "collectible" and item_id is not None:
                url = ARDOR + f"/gfx/items/{int(item_id):03}.png"
                raw = fetch(url)
                sprite = decode_image(raw)
                filename = f"collectible-{item_id}.png"
                result.update(source=url, sourceSha256=sha256(raw).hexdigest())
            elif kind in ("trinket", "consumable") and item_id is not None:
                if atlas_error:
                    raise RuntimeError(f"Atlas fetch failed: {atlas_error}")
                sprite_sheet, metadata, url, digest = atlases[kind]
                key = f"trinket_{int(item_id):03}" if kind == "trinket" else f"consumable_{item_id}"
                bounds = metadata[key]
                if sprite_sheet.size != (bounds["sheetW"], bounds["sheetH"]):
                    raise ValueError("Sprite atlas dimensions no longer match its metadata")
                x, y, size = bounds["x"], bounds["y"], bounds["size"]
                if x + size > sprite_sheet.width or y + size > sprite_sheet.height:
                    raise ValueError("Sprite lies outside its atlas")
                sprite = sprite_sheet.crop((x, y, x + size, y + size))
                filename = f"{kind}-{item_id}.png"
                result.update(source=url, sourceSha256=digest, atlasKey=key,
                              atlasRect=[x, y, size, size])
            elif kind == "character":
                url = ARDOR + "/gfx/characters/" + urllib.parse.quote(character_filename(node))
                raw = fetch(url)
                sprite = decode_image(raw)
                filename = f"character-{node_id.split(':', 1)[1]}.png"
                result.update(source=url, sourceSha256=sha256(raw).hexdigest())
            elif node.get("secretId") is not None or overrides.get(node_id, {}).get("achievementSpriteId"):
                override = overrides.get(node_id, {})
                sprite_id = override.get("achievementSpriteId", node.get("secretId"))
                url = ARDOR + f"/gfx/achievements/{int(sprite_id)}.png"
                raw = fetch(url)
                sprite = decode_image(raw)
                filename = f"feature-{node_id.split(':', 1)[1]}.png"
                result.update(source=url, sourceSha256=sha256(raw).hexdigest(),
                              imageKind="game-unlock-notification", artworkId=sprite_id,
                              semanticNote=override.get("semanticNote", "Artwork of the game's unlock notification; decorative only, never evidence of player achievements."))
            else:
                filename = node_id.replace(":", "-") + ".svg"
                raw = designed_svg(node).encode("utf-8")
                (args.output / filename).write_bytes(raw)
                return {**result, "status": "designed", "path": "assets/icons/" + filename,
                        "dimensions": [64, 64], "sha256": sha256(raw).hexdigest(),
                        "source": "tools/fetch_icons.py#designed_svg", "imageKind": "original-vector-illustration",
                        "semanticNote": "Original schematic illustration, not a game sprite."}
            if not sprite.getbbox():
                raise ValueError("Sprite image is entirely transparent")
            path = args.output / filename
            sprite.save(path, format="PNG", optimize=True)
            result.update(status="downloaded", path="assets/icons/" + filename,
                          dimensions=list(sprite.size), sha256=sha256(path.read_bytes()).hexdigest())
        except Exception as error:
            if valid_old:
                return {**old, "refreshError": f"{type(error).__name__}: {error}"}
            result.update(status="missing", reason=f"{type(error).__name__}: {error}")
        return result

    with ThreadPoolExecutor(max_workers=6) as executor:
        results = list(executor.map(package, nodes))
    manifest = {"schema": 2, "note": "Game art rights remain with their respective owners. No license inferred.",
                "atlasMetadataSource": ATLAS_DATA,
                "atlasMetadataSha256": atlas_digest, "icons": results}
    (args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    counts = {status: sum(row["status"] == status for row in results)
              for status in ("downloaded", "designed", "missing")}
    print(json.dumps(counts))
    for row in results:
        if row["status"] == "missing":
            print(row["nodeId"], row["reason"])
        elif row.get("refreshError"):
            print(row["nodeId"], "kept verified previous image:", row["refreshError"])
    if counts["missing"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
