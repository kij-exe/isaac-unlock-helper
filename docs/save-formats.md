# Which files to upload

The website needs **one persistentgamedata file holding the overall progress of a single slot**. Gamestate files contain the current run and are not used for tier lists, statistics or the unlock graph. There is no need to upload them alongside the main file.

| Edition | Typical Steam Cloud name for the first slot | Website features |
| --- | --- | --- |
| Repentance+ | `rep+persistentgamedata1.dat` | Tier list, graph and statistics, including online marks |
| Repentance | `rep_persistentgamedata1.dat` | Tier list, graph and statistics |
| Rebirth | `persistentgamedata1.dat` | Rebirth statistics: 11 characters × 6 marks, 20 challenges |

The trailing number is 1, 2 or 3. With Steam Cloud disabled, a name without a prefix may be used by a different edition. Copies with a date prepended to the name are supported without renaming. The edition is determined by the header **and the entire chunk layout**, not by the file name. If you play Repentance+, an old Rebirth file does not contain your later progress in the DLC.

On Windows the Steam Cloud folder is usually `C:\Program Files (x86)\Steam\userdata\<SteamID>\250900\remote\`. Local files are located in `%USERPROFILE%\Documents\My Games\Binding of Isaac Repentance+\`, `Binding of Isaac Repentance\` or `Binding of Isaac Rebirth\`. The home page lists paths for macOS and Linux / Steam Deck. Choose the current folder of your edition and the most recent copy of the desired slot by modification date. An empty slot is acceptable; the file of a slot that has not been created yet may be missing. Do not select options.ini, log.txt, an archive or a folder. For details on folder layout and backups, see the [IsaacScript author's FAQ](https://github.com/Zamiell/isaac-faq/blob/main/directories-and-save-files.md).

# Verified profiles

| Header | Secrets / counters | Chunks | Profile |
| --- | --- | --- | --- |
| `ISAACNGSAVE06R` | 179 / 95 | 9 | Rebirth |
| `ISAACNGSAVE09R` | 638 / 496 | 11 | Repentance |
| `ISAACNGSAVE09R` | 642 / 523 | 11 | Repentance+ |

An unknown schema, Afterbirth / Afterbirth+ or an old variant of Repentance+ is never silently accepted as a verified edition. The error shows the detected sizes and the supported profiles. Flags, bounds, sizes, structure and the checksum are validated. A corrupted copy does not replace an already loaded save; the error message stays above the current screen.

Repentance/Repentance+ use the KAGE checksum, while Rebirth uses a different algorithm: rotation of a 32-bit sum over the chunk headers and their elements, a seed derived from the load counter and a final XOR. The algorithms are implemented independently in JS and Python and produce identical results on the five provided persistentgamedata files. The structure of the new formats is described in [REPENTOGON SaveFile.h](https://github.com/TeamREPENTOGON/REPENTOGON/blob/main/repentogon/SaveSyncing/SaveFile.h); the Rebirth algorithm was checked against [the converter author's source code](https://github.com/akh5l/Binding-of-Isaac-Rebirth-Wii-U-to-PC-Save-File-Converter/blob/main/Checksum.cs).

# Repentance+ marks

Independent bits are stored: 1 — Normal offline, 2 — Hard offline, 4 — Normal online, 8 — Hard online. Sums such as 3 and 15 are valid. The value 4 is **not** treated as Hard. The model keeps rawValue, offline and online; the resulting mark corresponds to the better of the two recorded modes. Sources: [the Character Shenanigans author's description](https://steamcommunity.com/workshop/filedetails/?id=3130836503), retrieved via the official Steam GetPublishedFileDetails API, and [the bit split in REPENTOGON](https://github.com/TeamREPENTOGON/REPENTOGON/blob/main/repentogon/Patches/CompletionTracker.cpp#L85). This is slot completion data, not Steam achievements.

The additional counter names 496–522 were checked against [the current REPENTOGON enums_ex.lua](https://github.com/TeamREPENTOGON/REPENTOGON/blob/main/repentogon/resources/scripts/enums_ex.lua). Unknown 496 is not given a made-up meaning. Statistics show online streaks and recorded daily streaks separately.

Dead God for Repentance+ adds four conditions, 638–641, without 637. They are not proven by secret flags and require manual confirmation, specifically including the online daily rather than an ordinary daily win. The requirement of four additional conditions is stated in the [Isaac Wiki](https://bindingofisaacrebirth.wiki.gg/wiki/Achievements); the addition of Item Descriptions is confirmed by [the official patch 1.9.7.13 notes](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1810503566367174).

# Rebirth and missing data

The six marks are laid out as six groups of 11 characters in counters 26–91. The mapping was checked against [the original Rebirth parser](https://github.com/ihabunek/isaac/blob/master/src/SaveGame.php) and [its character/goal catalog](https://github.com/ihabunek/isaac/blob/master/src/Catalogue.php). Verified shared counters are translated into the common model; missing later metrics stay null and are displayed as "—". Fake zero marks for characters that do not exist in this edition are not added. This format has no bestiary of encounters/kills/deaths.

The tier list and graph conditions are designed for Repentance/Repentance+ and do not apply to Rebirth. Rebirth opens directly on the statistics view with a compatibility note. The Python CLI keeps the named Repentance analysis; its `--raw` additionally parses verified Rebirth and Repentance+ files, including their checksums. Saves are not converted and are never written back.
