#!/usr/bin/env python3
"""Read-only analyzer for the PC Repentance persistentgamedata format (stdlib only)."""

import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import struct
import sys
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent
HEADER = b"ISAACNGSAVE09R  "
CHUNKS = {
    1: ("achievements", 1), 2: ("event_counters", 4),
    3: ("level_counters", 4), 4: ("collection", 1),
    5: ("minibosses", 1), 6: ("bosses", 1), 7: ("challenges", 1),
    8: ("cutscenes", 4), 9: ("settings", 4), 10: ("special_seeds", 1),
    11: ("bestiary", None),
}
BESTIARY_SECTIONS = {4: "deaths", 2: "kills", 3: "hits", 1: "encounters"}
MARK_NAMES = {
    "KILL_MOMS_HEART": "Mom’s Heart / It Lives!", "KILL_ISAAC": "Isaac",
    "KILL_SATAN": "Satan", "BOSSRUSH_CLEARED": "Boss Rush",
    "KILL_BLUE_BABY": "???", "KILL_THE_LAMB": "The Lamb",
    "KILL_MEGA_SATAN": "Mega Satan", "KILL_HUSH": "Hush",
    "GREED_MODE_CLEARED": "Greed / Greedier", "KILL_DELIRIUM": "Delirium",
    "KILL_MOTHER": "Mother", "KILL_BEAST": "The Beast",
}
CHARACTER_NAMES = {
    "ISAAC": "Isaac", "MAGDALENE": "Magdalene", "CAIN": "Cain", "JUDAS": "Judas",
    "BLUE_BABY": "???", "EVE": "Eve", "SAMSON": "Samson", "AZAZEL": "Azazel",
    "LAZARUS": "Lazarus", "EDEN": "Eden", "THE_LOST": "The Lost", "LILITH": "Lilith",
    "KEEPER": "Keeper", "APOLLYON": "Apollyon", "FORGOTTEN": "The Forgotten",
    "THE_FORGOTTEN": "The Forgotten", "BETHANY": "Bethany",
    "JACOB_AND_ESAU": "Jacob & Esau",
}
IMPORTANT_STATS = {
    1: "Mom’s Heart / It Lives!: зачтённые победы", 10: "Смерти",
    11: "Isaac: зачтённые победы", 13: "Satan: зачтённые победы",
    24: "???: зачтённые победы", 25: "The Lamb: зачтённые победы",
    26: "Mega Satan: зачтённые победы", 111: "Boss Rush: прохождения",
    158: "Hush: зачтённые победы", 187: "Delirium: зачтённые победы",
    491: "Mother: зачтённые победы", 492: "The Beast: зачтённые победы",
    20: "Монеты в Donation Machine", 115: "Монеты в Greed Donation Machine",
    21: "Eden Tokens", 22: "Текущая серия побед", 23: "Лучшая серия побед",
    113: "Текущая серия поражений", 2: "Разрушено камней",
    3: "Разрушено tinted rocks", 5: "Разрушено кучек", 6: "Съедено пилюль",
    15: "Взято сделок ангела", 16: "Взято сделок дьявола", 197: "Покупки в магазине",
}


class SaveFormatError(ValueError):
    """The bytes cannot be interpreted safely using this format."""


class Reader:
    def __init__(self, data):
        self.data = data
        self.position = 0

    def take(self, size):
        if size < 0 or self.position + size > len(self.data):
            raise SaveFormatError(f"Truncated data at 0x{self.position:x}: need {size} bytes")
        start = self.position
        self.position += size
        return self.data[start:self.position]

    def uint(self):
        return struct.unpack("<I", self.take(4))[0]


def kage_checksum(payload):
    # KAGE's table uses arithmetic shifts of a *signed* polynomial. This is
    # different from CRC32/zlib even though the polynomial has the same bits.
    table = []
    signed_polynomial = 0xEDB88320 - (1 << 32)
    for byte in range(256):
        value = byte
        for _ in range(8):
            value = (value >> 1) ^ signed_polynomial if value & 1 else value >> 1
        table.append(value & 0xFFFFFFFF)
    value = (~0xFEDCBA76) & 0xFFFFFFFF
    for byte in payload:
        value = table[(value & 255) ^ byte] ^ (value >> 8)
    return (~value) & 0xFFFFFFFF


def parse_bytes(data, *, allow_invalid_checksum=False):
    """Decode all eleven chunks, retaining every value and unknown entity key."""
    reader = Reader(data)
    if reader.take(16) != HEADER:
        raise SaveFormatError("Expected ISAACNGSAVE09R header; Rebirth/Afterbirth are unsupported")
    gamestate_checksum = reader.uint()
    chunks = {}
    layout = []
    for expected_id, (name, width) in CHUNKS.items():
        offset = reader.position
        chunk_id, size_written, count = reader.uint(), reader.uint(), reader.uint()
        if chunk_id != expected_id:
            raise SaveFormatError(f"Expected chunk {expected_id} at 0x{offset:x}, got {chunk_id}")
        if count == 0:
            raise SaveFormatError(f"Empty chunk {chunk_id} is not a known layout")
        data_offset = reader.position
        if width is None:
            if count not in (4, 5):
                raise SaveFormatError(f"Unexpected bestiary section count: {count}")
            sections = {}
            total_written = 0
            for expected_section, section_name in BESTIARY_SECTIONS.items():
                section_id, written = reader.uint(), reader.uint()
                if section_id != expected_section or written % 4:
                    raise SaveFormatError("Unexpected bestiary section header")
                total_written += written
                # The stored length is entries*4, but each pair occupies 8 bytes.
                raw = reader.take(written * 2)
                entries = {}
                for key, value in struct.iter_unpack("<Ii", raw):
                    if key in entries or value < 0:
                        raise SaveFormatError("Duplicate bestiary key or negative count")
                    entries[key] = value
                sections[section_name] = entries
            if size_written != total_written:
                raise SaveFormatError("Bestiary chunk size disagrees with section sizes")
            chunks[name] = sections
        else:
            expected_size = count if chunk_id == 1 else count * 4
            if size_written != expected_size:
                raise SaveFormatError(f"Unexpected stored size for chunk {chunk_id}")
            raw = reader.take(count * width)
            if width == 1:
                if any(value not in (0, 1) for value in raw):
                    raise SaveFormatError(f"Non-boolean value in chunk {chunk_id}")
                chunks[name] = list(raw)
            else:
                chunks[name] = [value[0] for value in struct.iter_unpack("<i", raw)]
        layout.append({
            "id": chunk_id, "name": name, "header_offset": offset,
            "data_offset": data_offset, "count": count, "size_written": size_written,
            "actual_size": reader.position - data_offset,
        })
    load_counter, stored_checksum = reader.uint(), reader.uint()
    if reader.position != len(data):
        raise SaveFormatError(f"Unexpected trailing bytes: {len(data) - reader.position}")
    computed_checksum = kage_checksum(data[16:-4])
    if stored_checksum != computed_checksum and not allow_invalid_checksum:
        raise SaveFormatError("KAGE checksum mismatch; use --allow-invalid-checksum for diagnostics")
    return {
        "header": HEADER.decode("ascii"), "size_bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "gamestate_checksum": gamestate_checksum, "load_counter_raw": load_counter,
        "checksum": {"stored": stored_checksum, "computed": computed_checksum,
                     "valid": stored_checksum == computed_checksum},
        "layout": layout, "chunks": chunks,
    }


def character_name(enum_name):
    tainted = enum_name.startswith("T_")
    base = enum_name[2:] if tainted else enum_name
    name = CHARACTER_NAMES.get(base)
    if name is None:
        raise SaveFormatError(f"Unknown character in counter catalog: {enum_name}")
    if tainted and base == "JACOB_AND_ESAU":
        return "Tainted Jacob"
    return "Tainted " + name if tainted else name


def with_items_xml(catalog, paths):
    """Overlay real items.xml entries, in base → DLC order, onto the lookup data."""
    catalog = copy.deepcopy(catalog)
    items = {
        ("trinket" if i["kind"] == "trinket" else "collectible", i["item_id"]): i
        for i in catalog["items"] if i["kind"] in ("active", "passive", "trinket")
    }
    consumables = [i for i in catalog["items"] if i["kind"] == "consumable"]
    for path in paths:
        data = path.read_bytes()
        try:
            root = ET.fromstring(data)
            if root.tag != "items":
                raise SaveFormatError(f"{path}: expected an <items> root")
            for entry in root:
                if entry.tag not in ("active", "passive", "familiar", "trinket"):
                    continue
                item_id = int(entry.attrib["id"])
                achievement_id = int(entry.get("achievement", "0")) or None
                if item_id <= 0 or (achievement_id is not None and achievement_id < 0):
                    raise ValueError("Invalid item or achievement ID")
                namespace = "trinket" if entry.tag == "trinket" else "collectible"
                old = items.get((namespace, item_id), {})
                name = entry.get("name", "")
                if not name or name.startswith("#"):
                    name = old.get("name", f"{namespace} #{item_id}")
                items[(namespace, item_id)] = {
                    "item_id": item_id, "name": name,
                    "kind": entry.tag if entry.tag in ("active", "trinket") else "passive",
                    "requires_unlock": achievement_id is not None,
                    "achievement_id": achievement_id,
                    "unlock_condition": catalog["achievements"].get(str(achievement_id), {}).get("condition"),
                    "lookup_source": str(path),
                }
        except (ET.ParseError, KeyError, ValueError) as exc:
            raise SaveFormatError(f"{path}: invalid items.xml: {exc}") from exc
        catalog["sources"].append({"path": str(path), "sha256": hashlib.sha256(data).hexdigest(),
                                   "purpose": "items.xml unlock gates (overrides community catalog)"})
    catalog["items"] = list(items.values()) + consumables
    return catalog


def analyze(parsed, catalog):
    """Analyze this slot's recorded gameplay, without reading achievement values."""
    raw = parsed["chunks"]
    if (len(raw["achievements"]), len(raw["event_counters"])) != (638, 496):
        raise SaveFormatError(
            "Semantic analysis currently supports Repentance with 638 achievement slots and 496 counters; "
            "use --raw for other ISAACNGSAVE09R layouts"
        )
    counters = raw["event_counters"]
    characters = []
    for entry in catalog["characters"]:
        characters.append({
            "roster_index": entry["roster_index"], "name": entry["name"],
            "marks": {},
        })
    by_name = {entry["name"]: entry for entry in characters}
    for key, definition in catalog["event_counters"].items():
        counter_id = int(key)
        name = definition["name"]
        if counter_id >= len(counters) or not name.startswith("PROGRESSION_"):
            continue
        match = re.fullmatch(r"PROGRESSION_(.+)_WITH_(.+)", name)
        if not match or match[1] not in MARK_NAMES:
            raise SaveFormatError(f"Unrecognized completion counter: {name}")
        mark_type, char_key = match[1], match[2]
        value = counters[counter_id]
        if value not in (0, 1, 2):
            raise SaveFormatError(f"Unexpected Repentance completion value {value} in counter {counter_id}")
        mode = ("not_completed", "greed", "greedier") if mark_type == "GREED_MODE_CLEARED" else (
            "not_completed", "normal", "hard"
        )
        by_name[character_name(char_key)]["marks"][MARK_NAMES[mark_type]] = {
            "value": value, "status": mode[value], "counter_id": counter_id,
        }
    if any(len(char["marks"]) != 12 for char in characters):
        raise SaveFormatError("Reference catalog does not cover all 34 × 12 completion marks")

    items = []
    for entry in catalog["items"]:
        if entry["kind"] not in ("active", "passive"):
            continue
        item_id = entry["item_id"]
        items.append({
            "item_id": item_id, "name": entry["name"], "kind": entry["kind"],
            "collected": bool(raw["collection"][item_id]) if (
                item_id is not None and 0 < item_id < len(raw["collection"])
            ) else None,
        })
    known_collectibles = {i["item_id"] for i in items}
    unknown_collection_flags = [
        i for i, value in enumerate(raw["collection"]) if value and i not in known_collectibles
    ]
    bosses = [
        {"id": i, "name": catalog["bosses"].get(str(i), {}).get("name", f"Unknown boss #{i}"),
         "killed_flag": bool(raw["bosses"][i])}
        for i in range(1, len(raw["bosses"]))
    ]
    challenges = [
        {"id": i, "name": catalog["challenges"].get(str(i), {}).get("name", f"Challenge #{i}"),
         "completed": bool(raw["challenges"][i])}
        for i in range(1, len(raw["challenges"]))
    ]
    entity_lookup = {(x["id"], x["variant"]): x for x in catalog["entities"]}
    keys = set().union(*(section.keys() for section in raw["bestiary"].values()))
    bestiary = []
    for key in sorted(keys):
        # The complete packed key is retained, including bits we do not name.
        entity_type, variant = key >> 20, (key >> 8) & 0xFFF
        definition = entity_lookup.get((entity_type, variant), {})
        bestiary.append({
            "packed_key": key, "entity_type": entity_type, "variant": variant,
            "low_bits": key & 255,
            "name": definition.get("name", f"Unknown entity {entity_type}.{variant}"),
            "is_boss": definition.get("isBoss"),
            **{name: section.get(key, 0) for name, section in raw["bestiary"].items()},
        })
    warnings = [
        "Achievement flags and Steam unlocks are excluded from this gameplay analysis.",
        "Names use a community catalog; gameplay values come from this slot's non-achievement chunks.",
        "Boss flags, progression counters and bestiary kills track different events and need not agree.",
        "Collection flags mean picked up at least once, not unlocked; quest/internal entries exist.",
        "No run history, play time, dates or current-run inventory are available in these files.",
    ]
    if unknown_collection_flags:
        warnings.append(f"Unmapped collection flags: {unknown_collection_flags}; retained without guessing names.")
    if not parsed["checksum"]["valid"]:
        warnings.append("Checksum failed: all reported progress is unverified.")
    return {
        "edition": "Repentance (638 achievement slots / 496 event counters)",
        "evidence_policy": {
            "achievement_flags_used": False, "steam_achievements_used": False,
            "basis": "recorded_slot_data_only", "historical_origin": "not_verifiable_from_snapshot",
        },
        "summary": {
            "has_recorded_gameplay": any(any(raw[name]) for name in (
                "event_counters", "level_counters", "collection", "minibosses", "bosses", "challenges", "cutscenes"
            )) or bool(bestiary),
            "collected_flags_raw": sum(raw["collection"]),
            "named_collected_items": sum(i.get("collected") is True for i in items),
            "completed_challenges": sum(c["completed"] for c in challenges),
            "characters_with_marks": sum(any(m["value"] > 0 for m in c["marks"].values()) for c in characters),
            "completed_marks": sum(m["value"] > 0 for c in characters for m in c["marks"].values()),
            "boss_kill_flags_named": sum(b["killed_flag"] for b in bosses),
            "bestiary_entries": len(bestiary),
        },
        "statistics": [
            {"id": i, "name": label, "value": counters[i]}
            for i, label in IMPORTANT_STATS.items()
        ],
        "event_counters": [
            {"id": i, "name": catalog["event_counters"].get(str(i), {}).get("name", f"UNKNOWN_{i}"),
             "value": value}
            for i, value in enumerate(counters)
        ],
        "characters": characters, "items": items,
        "bosses": bosses, "challenges": challenges, "bestiary": bestiary,
        "unknown_collection_flags": unknown_collection_flags, "warnings": warnings,
    }


def achievement_reference(parsed, catalog):
    """Informational unlock flags only; never used to infer gameplay in this slot."""
    achievements = parsed["chunks"]["achievements"]

    def unlocked(achievement_id):
        if achievement_id is None or not 0 < achievement_id < len(achievements):
            return None
        return bool(achievements[achievement_id])

    rows = [
        {"save_secret_id": i, **catalog["achievements"].get(str(i), {"name": f"Achievement #{i}"}),
         "unlocked": bool(achievements[i]), "earned_in_this_slot": None}
        for i in range(1, len(achievements))
    ]
    items = []
    for entry in catalog["items"]:
        item = dict(entry)
        if not item["requires_unlock"]:
            item["unlocked"] = True
            item["unlock_basis"] = "available_by_default"
        elif item["achievement_id"] is not None:
            item["unlocked"] = unlocked(item["achievement_id"])
            item["unlock_basis"] = "save_secret_flag"
        else:
            item["unlocked"] = None
            item["unlock_basis"] = "unknown_mapping"
        items.append(item)
    return {
        "excluded_from_gameplay_analysis": True,
        "source": "save_chunk_1_not_a_steam_account_query",
        "unlock_origin": "unknown: gameplay, Steam sync, import or editing cannot be distinguished",
        "steam_account": {"status": "not_queried", "achievements": None},
        "summary": {"unlocked_save_secrets": sum(row["unlocked"] for row in rows),
                    "total_save_secrets": len(rows)},
        "achievements": rows,
        "content_unlocks": {
            "characters": [
                {"roster_index": entry["roster_index"], "name": entry["name"],
                 "unlocked": True if entry["name"] == "Isaac" else unlocked(entry["unlockAchId"]),
                 "save_secret_id": entry["unlockAchId"]}
                for entry in catalog["characters"]
            ],
            "items": items,
        },
    }


def markdown_report(report):
    raw, progress = report["raw"], report["progress"]
    summary = progress["summary"]
    lines = [
        f"# {report['file']}", "", f"Версия: {progress['edition']}.", "",
        f"Размер: {raw['size_bytes']} байт. KAGE checksum: **{'OK' if raw['checksum']['valid'] else 'FAIL'}**.",
        f"SHA-256: `{raw['sha256']}`", "",
        "## Прогресс этого слота", "",
        "Достижения и разблокировки исключены из анализа. Учитываются только отдельные записи прохождений, коллекции и статистики.", "",
        f"- Записи игрового прогресса: **{'есть' if summary['has_recorded_gameplay'] else 'нет'}**.",
        f"- Персонажи с отметками: **{summary['characters_with_marks']} / 34**.",
        f"- Отметки прохождения: **{summary['completed_marks']} / 408**.",
        f"- Испытания: **{summary['completed_challenges']} / 45**.",
        f"- Коллекция: **{summary['named_collected_items']} распознанных предметов**; "
        f"всего установлено {summary['collected_flags_raw']} байтовых флагов.",
        f"- Бестиарий: **{summary['bestiary_entries']}** записей.", "",
        "## Статистика", "", "| Показатель | Значение |", "| --- | ---: |",
    ]
    lines += [f"| {entry['name']} | {entry['value']} |" for entry in progress["statistics"]]
    lines += ["", "`MOM_KILLS` в игре означает зачтённые победы над Mom’s Heart / It Lives!, а не над Mom.",
              "", "## Персонажи и отметки", ""]
    lines.append("Доступность персонажа по секретам не используется для зачёта его прохождений.")
    lines += ["", "| Персонаж | Цель | Сложность | ID счётчика |", "| --- | --- | --- | ---: |"]
    for character in progress["characters"]:
        for name, mark in character["marks"].items():
            if mark["value"]:
                lines.append(f"| {character['name']} | {name} | {mark['status']} | {mark['counter_id']} |")
    lines += ["", "Все 408 состояний, включая незакрытые отметки, есть в JSON.",
              "", "## Испытания", ""]
    completed = [c for c in progress["challenges"] if c["completed"]]
    lines += [f"- #{c['id']} {c['name']}." for c in completed] or ["Нет пройденных."]
    lines += ["", "## Флаги побеждённых боссов", "",
              "Это отдельный учёт для разблокировок. Для количества убийств см. бестиарий; для персонажа и сложности — отметки.", ""]
    lines.append(", ".join(f"{b['name']} (#{b['id']})" for b in progress["bosses"] if b["killed_flag"]) or "Нет установленных флагов.")
    lines += ["", f"Минибоссы: флаги по индексам 0–6 = `{raw['chunks']['minibosses']}`."]
    lines += ["", "## Коллекция: подобранные предметы", ""]
    collected = [i for i in progress["items"] if i.get("collected")]
    lines.append(", ".join(f"{i['name']} (#{i['item_id']})" for i in sorted(collected, key=lambda i: i['item_id'])) or "Пусто.")
    if progress["unknown_collection_flags"]:
        lines += ["", f"Неопознанные флаги коллекции: `{progress['unknown_collection_flags']}`. Названия не угадываются."]
    lines += ["", "## Боссы в бестиарии", "",
              "Встречи могут учитывать составные части и повторные появления. Это не число забегов.", "",
              "| Враг | Type.Variant | Убийства | Встречи | Попадания по игроку | Смерти игрока |",
              "| --- | --- | ---: | ---: | ---: | ---: |"]
    lines += [f"| {b['name']} | {b['entity_type']}.{b['variant']} | {b['kills']} | {b['encounters']} | {b['hits']} | {b['deaths']} |"
              for b in progress["bestiary"] if b["is_boss"]]
    lines += ["", "## Служебные и нерасшифрованные данные", "",
              f"Level counters: `{raw['chunks']['level_counters']}`.",
              f"Cutscene counters: `{raw['chunks']['cutscenes']}`.",
              f"Settings: `{raw['chunks']['settings']}`.",
              f"Special seeds (установленные индексы): `{[i for i,v in enumerate(raw['chunks']['special_seeds']) if v]}`.",
              f"GameState checksum: `{raw['gamestate_checksum']}`. Сам забег хранится в отдельном gamestate*.dat.",
              f"Служебный счётчик загрузок (предположительное назначение): `{raw['load_counter_raw']}`.",
              "", "## Ограничения", ""]
    lines += ["- " + warning for warning in progress["warnings"]]
    reference_name = Path(report["file"]).stem + ".achievements.md"
    lines += ["", f"[Отдельная справка о секретах и разблокировках]({reference_name}). "
              "Её значения не участвуют в основном анализе; состояние Steam-аккаунта не проверялось."]
    return "\n".join(lines) + "\n"


def markdown_achievement_reference(report):
    reference = report["achievement_reference"]
    summary = reference["summary"]
    lines = [
        f"# Секреты и разблокировки: {report['file']}", "",
        "**Только справка. Эти данные исключены из анализа заслуг в текущем слоте.**", "",
        f"Установлено флагов секретов: **{summary['unlocked_save_secrets']} / {summary['total_save_secrets']}**.", "",
        "Источник — блок 1 сохранения. Steam-аккаунт не запрашивался: это не проверенный список достижений Steam. "
        "Нельзя определить, какие флаги получены здесь, перенесены из Steam, импортированы или отредактированы.", "",
        "Условия ниже приведены из справочника. Открытый секрет не доказывает выполнение условия в этом слоте. "
        "ID — игровой Save Secret ID; соответствие Steam API здесь не устанавливается.", "",
        "## Открытые секреты", "", "| Save Secret ID | Название | Условие из справочника |",
        "| ---: | --- | --- |",
    ]
    lines += [f"| {a['save_secret_id']} | {a['name']} | {a.get('condition', '')} |"
              for a in reference["achievements"] if a["unlocked"]]
    lines += ["", "## Доступность персонажей по секретам", ""]
    lines.append(", ".join(c["name"] for c in reference["content_unlocks"]["characters"] if c["unlocked"]) + ".")
    lines += ["", "Это доступность для выбора, а не доказательство игры или прохождений этим персонажем.",
              "", "## Разблокировки предметов по секретам", "",
              "Предметы с открытым секретом из справочника. Их наличие не засчитывается как выполнение условий в этом слоте. "
              "Коллекция читается отдельно в основном отчёте.", "",
              "| Название | Тип | ID предмета | Save Secret ID |", "| --- | --- | ---: | ---: |"]
    lines += [f"| {i['name']} | {i['kind']} | {i['item_id']} | {i['achievement_id']} |"
              for i in reference["content_unlocks"]["items"]
              if i["unlock_basis"] == "save_secret_flag" and i["unlocked"]]
    return "\n".join(lines) + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--output", type=Path, help="Create a JSON and Markdown report per file")
    parser.add_argument("--raw", action="store_true", help="Decode chunks only, without semantic labels")
    parser.add_argument("--items-xml", action="append", default=[], type=Path,
                        help="Override item/trinket unlock gates with game XML; repeat in base → DLC order")
    parser.add_argument("--allow-invalid-checksum", action="store_true", help="Diagnostic mode; mark results unverified")
    args = parser.parse_args(argv)
    if args.output:
        # Never let generated reports replace an input save, including via symlinks.
        inputs = {path.resolve() for path in args.files}
        outputs = []
        for path in args.files:
            suffixes = (".json",) if args.raw else (".json", ".md", ".achievements.json", ".achievements.md")
            for suffix in suffixes:
                output_path = (args.output / (path.stem + suffix)).resolve()
                if output_path in inputs:
                    parser.error("Output path would overwrite an input save")
                outputs.append(output_path)
        if len(set(outputs)) != len(outputs):
            parser.error("Report names collide; use separate output directories")
        args.output.mkdir(parents=True, exist_ok=True)
    catalog = None if args.raw else json.loads((ROOT / "data/catalog.json").read_text(encoding="utf-8"))
    if args.items_xml and args.raw:
        parser.error("--items-xml requires semantic analysis, not --raw")
    if args.items_xml:
        try:
            catalog = with_items_xml(catalog, args.items_xml)
        except (OSError, SaveFormatError) as exc:
            parser.error(str(exc))
    reports = []
    for path in args.files:
        try:
            parsed = parse_bytes(path.read_bytes(), allow_invalid_checksum=args.allow_invalid_checksum)
            report = {"file": path.name, "raw": parsed}
            if not args.raw:
                report["schema_version"] = 2
                report["progress"] = analyze(parsed, catalog)
                report["achievement_reference"] = achievement_reference(parsed, catalog)
                report["catalog_sources"] = catalog["sources"]
            if args.output:
                target = args.output / (path.stem + ".json")
                target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                if not args.raw:
                    (args.output / (path.stem + ".md")).write_text(markdown_report(report), encoding="utf-8")
                    reference_report = {
                        "schema_version": 2, "file": path.name, "save_sha256": parsed["sha256"],
                        "achievement_reference": report["achievement_reference"],
                    }
                    (args.output / (path.stem + ".achievements.json")).write_text(
                        json.dumps(reference_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                    (args.output / (path.stem + ".achievements.md")).write_text(
                        markdown_achievement_reference(report), encoding="utf-8")
                print(f"{path.name}: {report.get('progress', {}).get('summary', 'raw chunks decoded')}")
            reports.append(report)
        except (OSError, SaveFormatError) as exc:
            print(f"{path}: {exc}", file=sys.stderr)
            return 1
    if not args.output:
        print(json.dumps(reports[0] if len(reports) == 1 else reports, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
