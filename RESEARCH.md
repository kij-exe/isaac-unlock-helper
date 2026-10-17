# How to read The Binding of Isaac save files

## Conclusion

The two provided files yield persistent progress without launching the game: secrets, items in the collection, completion marks per character and difficulty, challenges, boss flags, the bestiary and statistics. The files are neither encrypted nor compressed. They are binary arrays with 11 chunks and a checksum.

The proposed approach is already implemented in `isaac_save.py`: **bytes → validated structure → progress model + reference catalogs → JSON / Markdown**. The originals are opened read-only. Reference catalogs are kept separate from the parser so that the community data can later be replaced with resources from a specific game installation. At the user's request, secrets and any unlocks derived from them are excluded from the primary and any future achievement-of-merit analysis: only `progress` is used for it.

## Relationship to Steam and the scope of analysis

Three states must be distinguished:

| Data | Source | What it confirms | Used in the merit analysis |
| --- | --- | --- | --- |
| Steam achievements | User account + appid 250900 | Achievement state of the account, not tied to a slot | No |
| Secret flags | Chunk 1 of the `.dat` | The secret is unlocked in this file; the source of the unlock is unknown | No |
| Marks, completed flags, collection, counters, bestiary | Other chunks of this `.dat` | Recorded progress state of the specific slot | Yes |

[Steamworks GetPlayerAchievements](https://partner.steamgames.com/doc/webapi/ISteamUserStats?l=english#GetPlayerAchievements) queries a user and an application. Isaac files do not contain a response from this API: the 77 flags of the first slot must not be declared the number of Steam achievements, and the empty chunk of the second slot must not be declared an absence of achievements on the account. The Steam account was not read in this research.

A practical scenario is described by the author of [Post-it for Dummies](https://github.com/agusaenz/isaac-save-auto-editor-steam#first-steps): secrets are carried over from Steam to a new slot, while crossed-out challenges and marks have to be restored with a separate write. We checked the tool's description and the separation of chunks in REPENTOGON; we did not run the restoration and did not modify the game or Steam. The mere fact that a secret is unlocked does not prove that its condition was met in the new slot.

A single snapshot cannot tell how a particular flag appeared: the game, Steam, an import or editing. Therefore **all** achievement flags are excluded from the primary analysis without trying to guess their origin. Kill counts, marks, difficulty, completed challenges, collection or having played a character must not be inferred from unlocked secrets. Marks are read for all 34 characters, even if the corresponding secret is locked.

In JSON schema_version 2 the main `progress` branch contains no achievements or content availability. The separate `achievement_reference` contains the flags, reference unlocks and `earned_in_this_slot=null`; `steam_account.status=not_queried`, `steam_account.achievements=null`. Separate `*.achievements.md` and `*.achievements.json` files are generated for reference. `raw` stores the original bytes for auditing, but is not a source of merit conclusions based on chunk 1.

A regression check simulates an empty slot with all 637 secrets set and a correct checksum. Its `progress` matches the `progress` of the original empty file exactly. Another check clears and fills the secrets of the first slot: its three marks and all other game data stay unchanged. These modifications are made only in test memory. The rule for further work is recorded in `AGENTS.md`.

Limit of reliability: a slot's own records do not prove the historical origin of the bytes either, after a possible import or edit. What is recorded here is precisely the state of the file. Achievements are not used to fill in missing records.

## Verified samples

| File | Size | Achievements / counters | KAGE checksum | SHA-256 |
| --- | ---: | --- | --- | --- |
| `rep_persistentgamedata1.dat` | 7772 | 638 / 496 | `E5440238`, matched | `b1e92f90b7f439bc7200b8fc08b1bec912fec8801a24c0256b15e5c1366b601e` |
| `rep_persistentgamedata2.dat` | 3956 | 638 / 496 | `01558F80`, matched | `85386edd59393e9d03ca6a9ae05b2fe54f7cb689e5a2ec944aaec1b18c23e046` |

Both use the Repentance schema. The second file is shorter because of an empty bestiary, not because of corruption. The number in the name denotes the slot; these are not two consecutive snapshots of the same playthrough.

Header of both: `ISAACNGSAVE09R  `, 16 bytes. This header is shared with Afterbirth+ and Repentance+, so the edition is determined by the chunk layout, not by the string or the file name. The exact patch number cannot be determined from these files.

## Container structure

All multi-byte numbers are read as little-endian. Start:

```text
offset 0x00: char[16]  "ISAACNGSAVE09R  "
offset 0x10: uint32    checksum of the linked gamestate, 0 in both files
offset 0x14:          first chunk
```

Header of each chunk:

```text
uint32 chunk_id
uint32 size_written
uint32 element_count
... data ...
```

**`size_written` cannot be relied on when walking the file.** Many boolean chunks record `count × 4`, even though each element occupies one byte. For example, the collection has `size_written=2932` but actually occupies **733 bytes**. You need to know the chunk type and compute the size from the element count.

| ID | Chunk | Elements in samples | Type | Data start | Actual size |
| ---: | --- | ---: | --- | --- | ---: |
| 1 | Achievements | 638 | byte bool | `0x0020` | 638 |
| 2 | Event counters | 496 | int32 | `0x02AA` | 1984 |
| 3 | Level counters | 14 | int32 | `0x0A76` | 56 |
| 4 | Collection | 733 | byte bool | `0x0ABA` | 733 |
| 5 | Minibosses | 7 | byte bool | `0x0DA3` | 7 |
| 6 | Bosses | 104 | byte bool | `0x0DB6` | 104 |
| 7 | Challenges | 46 | byte bool | `0x0E2A` | 46 |
| 8 | Cutscenes | 27 | int32 | `0x0E64` | 108 |
| 9 | Settings | 2 | int32 | `0x0EDC` | 8 |
| 10 | Special seeds | 80 | byte bool | `0x0EF0` | 80 |
| 11 | Bestiary | 4 sections | key/value pairs | `0x0F4C` | 3848 / 32 |

The offsets here are results of researching these files, **not universal parser constants**. A different achievement count in another edition will shift the subsequent chunks.

After the chunks: a 4-byte internal counter, then a 4-byte checksum. The counter is 1418 in the first file and 6 in the second. According to REPENTOGON research it probably increments on save loads; it must not be treated as a number of runs or as play time.

### Checksum

It covers the range **from offset 16 up to, but not including, the final 4-byte checksum**. The initial value is `0xFEDCBA76`, with inversion before and after the pass. The table uses the polynomial `0xEDB88320`, but is generated with an arithmetic shift of a signed number. Therefore the standard `zlib.crc32` does not work.

In the implementation the table is computed independently, without copying anyone else's array. The result matched all 256 values of the table in the researched editor and both checksums stored by the game. The checksum itself diagnoses whether the bytes conform to the format, but does not prove that the progress was never edited.

## How to extract useful information

### Achievements and unlocked items

Chunk 1 is a flag for each Achievement ID. Index 0 is reserved; values 1–637 give 637 secrets. 77 are unlocked in the first slot, 0 in the second.

Item IDs and achievement IDs belong to different spaces. For example:

```text
collectible 20 = Transcendence
achievement 8 = A Noose, unlocks Transcendence
```

The value `achievements[8] = 1` says that the A Noose secret is unlocked and allows showing Transcendence's availability for reference. It **does not prove** that its condition was met in this slot. The value `collection[20] = 0` means the item is not marked in the collection. The first file has exactly this combination. The primary analysis uses only the collection; the secret state is shown separately.

Reference information about item unlocks requires an external catalog: item → actual condition/achievement. Items without a condition are available from the start. An achievement linked to an item is not always a gate: for example, entries about content being added to booster packs must not be automatically turned into per-item locks. Only in `achievement_reference` does the analyzer take the catalog's `requires_unlock` into account, and with `--items-xml` it uses `achievement` from the game resources. These results are excluded from the merit analysis.

The primary verifiable source for a specific installation is the unpacked `items.xml`, if needed several layers of the base game and DLCs. For cards/pills — `pocketitems.xml`; for characters — `players.xml`; for names and conditions — string tables and achievements. These resources are not in `context/`, so names and part of the semantics currently rely on a pinned community catalog. For conditions without a known mapping, `unlocked=null` is returned rather than a made-up answer. Examples of such entries in the current catalog: Telescope Lens and Cracked Key.

Chunk 4 is the "item picked up at least once" collection, not a list of unlocked items. 146 flags are set in total; 144 matched named items. The set indices **43 and 61** have no match in the catalog. Researching these two files does not allow reliably explaining their origin, so they are kept as unknown. This is not grounds to declare the whole file corrupted: the checksum and structure are correct.

Some cells may belong to unused, hidden or story objects. Therefore the number of set flags must not be divided by 733 and presented as a Dead God completion percentage.

### Bosses: three different kinds of data

1. **Character marks** in event counters show completion of major goals and the highest credited difficulty.
2. **Boss flags** in chunk 6 are used to track unlocks. The ID corresponds to BossType, not EntityType. Index 0 is kept in raw and does not get a boss name.
3. **The bestiary** stores statistics for individual entities and variants: encounters, kills, hits on the player, player deaths.

These values answer different questions and do not have to match. In the first file, for example, `MOM_KILLS=11`, but the Mom’s Heart bestiary entry has 12 kills. Satan has a credited victory and a mark, even though the main Satan entity has 0 kills in the bestiary. The cause of discrepancies cannot be established from a single snapshot; multi-part bosses and different crediting rules call for caution.

**`MOM_KILLS` is the name of the Mom’s Heart / It Lives! counter, not Mom.** REPENTOGON explains this separately. Hush was encountered but not defeated: its entry has 0 kills and 1 player death.

### Character completion marks

These are separate int32 values in chunk 2, **not a single mask for all characters** in this edition. The counters are laid out in several non-contiguous groups: a universal offset `base + character × 12` cannot be computed.

For Repentance:

```text
0 = no mark
1 = Normal
2 = Hard

For the Greed goal:
0 = not completed
1 = Greed
2 = Greedier
```

Hard stores the higher state and does not tell how many wins there were on Normal separately. Greed and Greedier are represented by a single counter, not by two independently stored marks.

Non-zero counters in the first slot:

| Counter ID | Character | Goal | Value |
| ---: | --- | --- | ---: |
| 34 | Azazel | Mom’s Heart / It Lives! | 2, Hard |
| 62 | Azazel | Satan | 2, Hard |
| 76 | Azazel | Boss Rush | 2, Hard |

All other 405 marks are zero. The groups for The Forgotten, Bethany, Jacob & Esau and the Tainted characters are mapped using named EventCounter IDs from REPENTOGON. The resulting catalog covers **34 × 12 = 408** states; the code checks that the mapping is complete.

Repentance+ may use additional values for online completions. This named analyzer does not carry the 0/1/2 rules over to Repentance+; an unsupported schema is rejected, and raw parsing is available separately.

### Bestiary

Section order: **4 deaths → 2 kills → 3 hits → 1 encounters**. Each section:

```text
uint32 section_id
uint32 entries_times_four
repeat entries_times_four / 4 times:
    uint32 packed_entity_key
    int32  value
```

An entry actually occupies 8 bytes, despite the `entries × 4` size field. The size field of the whole chunk equals the sum of these written sizes, excluding section headers. An empty bestiary still occupies 32 bytes: four 8-byte headers.

The key is decoded as follows:

```python
entity_type = key >> 20
variant = (key >> 8) & 0xFFF
low_bits = key & 0xFF
```

Values of the unknown low bits are not discarded; the full key remains in the report. In the researched entries the low bits are zero. Names are looked up by the Type/Variant pair; unknown or modded entities keep their IDs and all statistics.

In the first slot: 1 deaths entry, 209 kills, 36 hits and 231 encounters; the union contains 231 keys. This is the number of entry kinds/variants, not the total number of enemies encountered. The sums of kill and encounter counters are not equal to the number of runs and, for multi-part enemies, are not necessarily equal to the number of full bosses.

### Other data

- **Challenges:** cells 1–45 in chunk 7. In the first file only #6 Solar System is completed. Whether the challenge itself is unlocked for selection is a separate question of conditions/achievements.
- **Statistics:** deaths, streaks, Eden Tokens, donation machines, destroyed rocks, cards, pills, purchases, deals, opened chests and other counters. Zero values are kept as well.
- **Cutscenes:** 27 numeric values; indices and values are kept. Full naming requires the corresponding XML, which is not among the samples.
- **Level counters, special seeds and settings:** read in full. The purpose of individual fields is not guessed.
- **GameState checksum:** a reference for validating a separate file of a resumable run. 0 in both samples. No `gamestate*.dat` is among the provided files.

## What is not here

These two persistentgamedata files cannot reliably reconstruct run history, dates of wins and unlocks, total play time, the seed of each past run, the current inventory, or the rooms and route of the current run. There is also no separate count of wins by each character over each boss: a mark records a completion state, not a history of events.

Do not derive "total runs = MOM_KILLS + DEATHS": different modes, goals, restarts and ways of ending a run are counted. The load counter is not a substitute for game statistics.

## Architecture of the future tool

The foundation already exists: a verified byte decoder and JSON that an application can consume. The next useful layer of the primary analysis is missing marks for each character, uncompleted challenges, missing collection entries and comparison of the slot's own counters. Achievements and derived content availability must not change these conclusions or fill in missing progress. Conditions and rewards can be a static catalog, but an unlocked secret is not counted as meeting the condition here.

Before promising an exact merit tracker, the version resources and collection exceptions need to be clarified. Using an achievement/Dead God percentage derived from secrets as the current slot's merit percentage is forbidden. With consecutive backups, changes in marks, collection and statistics can be compared; a single snapshot contains no event dates. Secrets may be compared only in a separate reference report, without conclusions about the origin of the change. For the current state it is enough to re-read the local file after it changes — no Steam connection is required.

## Primary sources

- [REPENTOGON: SaveFile.h, pinned snapshot](https://github.com/TeamREPENTOGON/REPENTOGON/blob/9833f482100d6a62896831d2c744d1efe710d7f1/repentogon/SaveSyncing/SaveFile.h) — container, types, sizes, chunk order and the bestiary.
- [REPENTOGON: SaveFile.cpp](https://github.com/TeamREPENTOGON/REPENTOGON/blob/9833f482100d6a62896831d2c744d1efe710d7f1/repentogon/SaveSyncing/SaveFile.cpp) — structural checks and the checksum range.
- [REPENTOGON: EventCounter](https://repentogon.com/enums/EventCounter.html) — statistics and named mark IDs; [PersistentGameData](https://repentogon.com/PersistentGameData.html) — the distinction between `IsItemInCollection`, `Unlocked`, `IsBossKilled` and the bestiary.
- [isaac-save-edit-script: script.py](https://github.com/jamesthejellyfish/isaac-save-edit-script/blob/516fe1c8d3245677313c159bd1debde37f80fbd0/script.py) — an independent implementation of the checksum table and Repentance handling. The mutating editor was not run.
- [Isaac Lua API: items.xml](https://wofsauge.github.io/IsaacDocs/rep/xml/items.html) — resource fields, including achievement.
- [Deadgod Tracker: pinned public data module](https://deadgod.yeeterie.org/assets/data-d8ce3ab0.js) — reference names, conditions, characters, items, challenge rewards and entities. The module's code was not executed, and no saves were passed to it. The exact SHA-256 of all imported sources is recorded in `data/catalog.json`.

The protocol description was checked against the actual parsing of both files down to the last byte and against their original checksums. Conditions from the community catalog are marked separately from data read directly from the save.


## Addendum: new files

Verified profiles Rebirth 179/95 and Repentance+ 642/523 have been added. Their structure, the separate Rebirth checksum and the bit-based online marks are covered in [docs/save-formats.md](docs/save-formats.md). The previously described limitations of the named Python analyzer remain its limitations; the website supports the new profiles. Gamestate is excluded from the analysis of overall progress at the user's direct request.
