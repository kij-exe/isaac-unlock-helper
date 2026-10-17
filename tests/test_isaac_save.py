"""Format failure cases plus regression checks on the supplied research saves."""

import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest

from isaac_save import (
    ROOT, SaveFormatError, achievement_reference, analyze, kage_checksum, parse_bytes, with_items_xml,
)
from tools.build_catalog import LiteralReader


class SaveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        first = ROOT / "context/rep_persistentgamedata1.dat"
        second = ROOT / "context/rep_persistentgamedata2.dat"
        if not first.exists() or not second.exists():
            raise unittest.SkipTest("Integration checks need the two original context saves")
        cls.first = first.read_bytes()
        cls.second = second.read_bytes()
        cls.catalog = json.loads((ROOT / "data/catalog.json").read_text())

    def test_original_checksums_match_external_reference(self):
        # These are the checksums stored by the game, not calculated by this test.
        self.assertEqual(kage_checksum(self.first[16:-4]), 0xE5440238)
        self.assertEqual(kage_checksum(self.second[16:-4]), 0x01558F80)

    def test_chunk_size_does_not_skip_boolean_arrays(self):
        data = parse_bytes(self.first)
        collection = data["layout"][3]
        self.assertEqual(collection["size_written"], 2932)
        self.assertEqual(collection["actual_size"], 733)
        self.assertEqual(data["layout"][4]["header_offset"], 0xD97)
        self.assertEqual(data["layout"][-1]["actual_size"], 3848)

    def test_progress_matches_named_counter_reference(self):
        progress = analyze(parse_bytes(self.first), self.catalog)
        self.assertNotIn("unlocked_achievements", progress["summary"])
        self.assertEqual(progress["summary"]["named_collected_items"], 144)
        self.assertEqual(progress["unknown_collection_flags"], [43, 61])
        azazel = next(c for c in progress["characters"] if c["name"] == "Azazel")
        self.assertEqual({name for name, m in azazel["marks"].items() if m["status"] == "hard"},
                         {"Mom’s Heart / It Lives!", "Satan", "Boss Rush"})
        self.assertEqual(progress["summary"]["completed_marks"], 3)
        self.assertEqual(len(progress["characters"]), 34)
        self.assertTrue(all(len(c["marks"]) == 12 for c in progress["characters"]))

    def test_empty_slot_is_valid_not_truncated(self):
        progress = analyze(parse_bytes(self.second), self.catalog)
        self.assertFalse(progress["summary"]["has_recorded_gameplay"])
        self.assertEqual(progress["summary"]["completed_marks"], 0)
        self.assertEqual(progress["bestiary"], [])
        reference = achievement_reference(parse_bytes(self.second), self.catalog)
        self.assertEqual([c["name"] for c in reference["content_unlocks"]["characters"] if c["unlocked"]], ["Isaac"])

    def test_bestiary_distinguishes_encounter_from_victory(self):
        progress = analyze(parse_bytes(self.first), self.catalog)
        hush = next(e for e in progress["bestiary"] if e["entity_type"] == 407 and e["variant"] == 0)
        self.assertEqual(hush["name"], "Hush")
        self.assertEqual(hush["kills"], 0)
        self.assertEqual(hush["deaths"], 1)
        self.assertGreater(hush["encounters"], 0)

    def test_item_gate_and_collection_are_independent(self):
        parsed = parse_bytes(self.first)
        progress = analyze(parsed, self.catalog)
        reference = achievement_reference(parsed, self.catalog)
        items = reference["content_unlocks"]["items"]
        transcendence = next(i for i in items if i["name"] == "Transcendence")
        self.assertTrue(transcendence["unlocked"])
        collected_item = next(i for i in progress["items"] if i["name"] == "Transcendence")
        self.assertFalse(collected_item["collected"])
        self.assertNotIn("unlocked", collected_item)
        self.assertNotIn("collected", transcendence)
        little_horn = next(i for i in items if i["name"] == "Little Horn")
        # A catalog's related achievement is not necessarily an item gate.
        self.assertTrue(little_horn["unlocked"])
        self.assertEqual(little_horn["unlock_basis"], "available_by_default")
        telescope = next(i for i in items if i["name"] == "Telescope Lens")
        self.assertIsNone(telescope["unlocked"])

    def test_all_secrets_on_empty_save_do_not_create_any_gameplay(self):
        # Simulate a secret-only import using a valid checksum, without touching context files.
        data = bytearray(self.second)
        data[33:670] = b'\x01' * 637
        struct.pack_into("<I", data, len(data) - 4, kage_checksum(data[16:-4]))
        imported = parse_bytes(data)
        empty = parse_bytes(self.second)
        self.assertEqual(analyze(imported, self.catalog), analyze(empty, self.catalog))
        progress = analyze(imported, self.catalog)
        self.assertFalse(progress["summary"]["has_recorded_gameplay"])
        self.assertEqual(progress["summary"]["completed_marks"], 0)
        self.assertEqual(progress["summary"]["completed_challenges"], 0)
        self.assertEqual(progress["summary"]["named_collected_items"], 0)
        reference = achievement_reference(imported, self.catalog)
        self.assertEqual(reference["summary"]["unlocked_save_secrets"], 637)
        self.assertTrue(all(a["earned_in_this_slot"] is None for a in reference["achievements"]))

    def test_existing_slot_progress_is_invariant_to_secret_flags(self):
        parsed = parse_bytes(self.first)
        expected = analyze(parsed, self.catalog)
        for value in (0, 1):
            parsed["chunks"]["achievements"] = [value] * 638
            self.assertEqual(analyze(parsed, self.catalog), expected)
        self.assertEqual(expected["summary"]["completed_marks"], 3)
        self.assertEqual(expected["summary"]["characters_with_marks"], 1)

    def test_save_secret_flags_are_not_reported_as_steam_account_state(self):
        reference = achievement_reference(parse_bytes(self.first), self.catalog)
        self.assertEqual(reference["summary"]["unlocked_save_secrets"], 77)
        self.assertEqual(reference["steam_account"]["status"], "not_queried")
        self.assertIsNone(reference["steam_account"]["achievements"])
        self.assertTrue(reference["excluded_from_gameplay_analysis"])

    def test_truncation_is_rejected(self):
        for length in (0, 15, 19, 31, 700, 3900, len(self.first) - 1):
            with self.subTest(length=length), self.assertRaises(SaveFormatError):
                parse_bytes(self.first[:length])

    def test_unsupported_header_is_rejected(self):
        damaged = b"ISAACNGSAVE08R  " + self.first[16:]
        with self.assertRaisesRegex(SaveFormatError, "header"):
            parse_bytes(damaged)

    def test_checksum_failure_is_explicit(self):
        damaged = bytearray(self.first)
        damaged[0x2AA + 2 * 4] ^= 1  # A rock counter, still structurally valid.
        with self.assertRaisesRegex(SaveFormatError, "checksum"):
            parse_bytes(damaged)
        parsed = parse_bytes(damaged, allow_invalid_checksum=True)
        self.assertFalse(parsed["checksum"]["valid"])
        self.assertTrue(any("unverified" in warning for warning in analyze(parsed, self.catalog)["warnings"]))

    def test_invalid_bool_or_chunk_id_is_rejected(self):
        for offset, value in ((32, 2), (0xD97, 9)):
            damaged = bytearray(self.first)
            damaged[offset] = value
            with self.subTest(offset=offset), self.assertRaises(SaveFormatError):
                parse_bytes(damaged, allow_invalid_checksum=True)

    def test_trailing_data_is_rejected(self):
        with self.assertRaisesRegex(SaveFormatError, "trailing"):
            parse_bytes(self.first + b"extra")

    def test_unknown_entity_is_retained(self):
        damaged = bytearray(self.first)
        section_offset = parse_bytes(self.first)["layout"][-1]["data_offset"]
        key = (4090 << 20) | (777 << 8) | 5
        struct.pack_into("<I", damaged, section_offset + 8, key)
        parsed = parse_bytes(damaged, allow_invalid_checksum=True)
        entry = next(e for e in analyze(parsed, self.catalog)["bestiary"] if e["packed_key"] == key)
        self.assertEqual((entry["entity_type"], entry["variant"], entry["low_bits"]), (4090, 777, 5))
        self.assertIsNone(entry["is_boss"])
        self.assertEqual(entry["deaths"], 1)

    def test_other_09r_schema_is_not_silently_labelled_rep(self):
        parsed = parse_bytes(self.second)
        parsed["chunks"]["achievements"].extend([0] * 4)
        with self.assertRaisesRegex(SaveFormatError, "638"):
            analyze(parsed, self.catalog)

    def test_cli_preserves_input_and_dated_names(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            save = root / "20261014.rep_persistentgamedata1.dat"
            save.write_bytes(self.first)
            result = subprocess.run([sys.executable, str(ROOT / "isaac_save.py"), str(save),
                                     "--output", str(root / "reports")], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(hashlib.sha256(save.read_bytes()).digest(), hashlib.sha256(self.first).digest())
            self.assertTrue((root / "reports/20261014.rep_persistentgamedata1.json").exists())
            self.assertTrue((root / "reports/20261014.rep_persistentgamedata1.md").exists())
            main_report = json.loads((root / "reports/20261014.rep_persistentgamedata1.json").read_text())
            self.assertNotIn("achievements", main_report["progress"])
            self.assertEqual(main_report["schema_version"], 2)
            reference_path = root / "reports/20261014.rep_persistentgamedata1.achievements.json"
            self.assertTrue(reference_path.exists())
            self.assertTrue((root / "reports/20261014.rep_persistentgamedata1.achievements.md").exists())
            reference_report = json.loads(reference_path.read_text())
            self.assertNotIn("progress", reference_report)
            main_md = (root / "reports/20261014.rep_persistentgamedata1.md").read_text()
            self.assertNotIn("## Unlocked secrets", main_md)
            self.assertNotIn("## Item unlocks from secrets", main_md)

    def test_cli_rejects_output_symlink_to_input(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            save = root / "save.dat"
            save.write_bytes(self.first)
            (root / "save.json").symlink_to(save)
            result = subprocess.run([sys.executable, str(ROOT / "isaac_save.py"), str(save),
                                     "--output", str(root)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(save.read_bytes(), self.first)

    def test_game_xml_overrides_catalog_and_keeps_namespaces_separate(self):
        with tempfile.TemporaryDirectory() as directory:
            xml = Path(directory) / "items.xml"
            xml.write_text('<items><active id="20" name="#TRANSCENDENCE" />'
                           '<trinket id="20" name="Test Trinket" achievement="1" /></items>')
            catalog = with_items_xml(self.catalog, [xml])
            reference = achievement_reference(parse_bytes(self.first), catalog)
            items = reference["content_unlocks"]["items"]
            item = next(i for i in items if i["name"] == "Transcendence")
            self.assertEqual(item["unlock_basis"], "available_by_default")
            trinket = next(i for i in items if i["name"] == "Test Trinket")
            self.assertFalse(trinket["unlocked"])
            original = next(i for i in self.catalog["items"] if i["name"] == "Transcendence")
            self.assertEqual(original["achievement_id"], 8)

    def test_xml_layers_apply_in_requested_order(self):
        with tempfile.TemporaryDirectory() as directory:
            base, dlc = Path(directory) / "base.xml", Path(directory) / "dlc.xml"
            base.write_text('<items><passive id="20" achievement="1" /></items>')
            dlc.write_text('<items><passive id="20" achievement="8" /></items>')
            reference = achievement_reference(parse_bytes(self.first), with_items_xml(self.catalog, [base, dlc]))
            item = next(i for i in reference["content_unlocks"]["items"] if i["name"] == "Transcendence")
            self.assertTrue(item["unlocked"])
            self.assertEqual(item["achievement_id"], 8)


class CatalogLiteralTests(unittest.TestCase):
    def test_literal_reader_cannot_execute_expressions(self):
        with self.assertRaises(ValueError):
            LiteralReader('{name:process.exit(0)}', 0).value()

    def test_js_data_literals(self):
        self.assertEqual(LiteralReader('{a:!0,b:!1,c:null,d:.1,s:\'a "quote"\'}', 0).value(),
                         {"a": True, "b": False, "c": None, "d": .1, "s": 'a "quote"'})

class AdditionalFormatTests(unittest.TestCase):
    def test_rebirth_nine_chunks_and_own_checksum(self):
        path = ROOT / 'context/persistentgamedata1.dat'
        if not path.exists():
            self.skipTest('Private Rebirth fixture not available')
        before = path.read_bytes()
        parsed = parse_bytes(before)
        self.assertEqual(parsed['header'], 'ISAACNGSAVE06R  ')
        self.assertEqual(parsed['checksum']['computed'], 0xbd3b8630)
        self.assertEqual(len(parsed['layout']), 9)
        self.assertEqual(len(parsed['chunks']['event_counters']), 95)
        damaged = bytearray(before)
        damaged[227] ^= 1
        with self.assertRaisesRegex(SaveFormatError, 'checksum'):
            parse_bytes(damaged)
        self.assertEqual(path.read_bytes(), before)

    def test_rep_plus_raw_layouts_and_checksums(self):
        for name, checksum in [('rep+persistentgamedata1.dat', 0x04adfd70), ('rep+persistentgamedata2.dat', 0xf9cacd7e)]:
            path = ROOT / 'context' / name
            if not path.exists():
                self.skipTest('Private Repentance+ fixtures not available')
            before = path.read_bytes()
            parsed = parse_bytes(before)
            self.assertEqual(parsed['checksum']['computed'], checksum)
            self.assertEqual(len(parsed['chunks']['achievements']), 642)
            self.assertEqual(len(parsed['chunks']['event_counters']), 523)
            self.assertEqual(path.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
