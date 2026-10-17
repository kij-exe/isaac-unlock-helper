# Isaac Unlock Helper

## Skill Issue Tracker website

The finished frontend lives in `site/`: `.dat` upload without sending anything to a server, a tier list, an item wiki, statistics, a graph for each unlock and a full graph with shared dependencies. The catalog contains 188 entries from jnub's guide, grouped into S–F by unlock priority, 311 nodes with dependencies and 311 local icons (209 game PNGs and 102 SVG illustrations).

```sh
npm run dev
```

Open `http://127.0.0.1:4173/`, locate your save using the instructions and attach the file. No package installation is needed. Node.js is used only for the local server and checks; the published website is fully static.

- [Publishing to GitHub Pages](docs/github-pages.md): the workflow is already in `.github/workflows/pages.yml`.
- [How conditions and the graph work](docs/unlock-schema.md): nested AND/OR, confirmed marks, counter thresholds and manual facts.
- [Skill for adding unlocks](.agents/skills/isaac-unlocks/SKILL.md): a new item is connected to the shared graph via JSON.
- [Localization (EN / RU)](docs/i18n.md): how translation works and how to add new strings.
- [Tier list sources](docs/guide-sources.md) and [local sprite sources](docs/asset-sources.md).

All 45 challenges are connected to the graph: access conditions → challenge → a separate "Complete #…" step → shared goal and rewards. An unlocked challenge is not counted as completed; completion is confirmed only by the slot's completed flag.

Above S–F there is a separate Dead God tier with a single goal: all 636 unlock conditions and 717 collection items of Repentance. Details and the limits of automatic confirmation are described in the [schema](docs/unlock-schema.md#the-dead-god-goal). Isaac in the logo dances constantly: the local GIF loops and is visible without hovering.

The start screen shows a short animated "save → tier list → unlock graph" example with a pause control and support for reduced motion.

Clicking a sprite opens the graph; a separate ↗ button opens the wiki. The name and state labels appear on hover or focus. A dot indicates availability via secrets; a check mark indicates a pickup in this slot. The ☾ / ☀ button toggles between light and dark themes. The website is in English by default; the RU / EN switch in the header translates the interface, instructions, statistics and unlock conditions. English is the canonical source language in code and in `site/data/unlocks.json`; Russian website translations live in `site/js/locales/ru.js` and `site/js/locales/ru-catalog.js`. Only the theme and language are persisted (the language preference is stored in the `localStorage` key `atlas-language`); the save and manual confirmations stay in the current tab. Switching the language does not require re-uploading the file and preserves filters, the selected node and the graph zoom. The vertical graph supports mouse-wheel zoom around the cursor, dragging of blocks and the background, moving blocks with the arrow keys, fit-to-view and smooth layout restoration. The main statistics and the graph use only slot progress by default. A separate "Content availability" graph mode hides dependencies that are already available via secrets and is clearly marked as reference-only; it does not change how the slot's accomplishments are credited.

If B is required for both A and C, a locked B is shown as a shared node. When B is fulfilled in the selected mode, it and its history are hidden, and A/C remain separate tasks. Conditions without saved proof are shown as unknown; they can be explicitly confirmed manually in the current tab.

```sh
npm test
npm run validate:data
npm run build
```

`dist/` contains only the public website: saves and personal reports are not copied into it. Repentance and Repentance+ are supported; for Rebirth, statistics for that version are available. You need the persistentgamedata file, not gamestate. [Formats and choosing the file](docs/save-formats.md). Each tier-list entry stores its row (`rank`) and position (`order`) in `site/data/unlocks.json`; the initial rows were derived from the guide's categories and are edited independently from now on. The S–F letter grades are an editorial grouping, not the author's ratings or a universal item power ranking. Rows can be rearranged on the site by drag and drop and exported with the “Dump tiers (JSON)” button; the downloaded file replaces `site/data/unlocks.json`.

## Python analyzer

A local save analyzer for **The Binding of Isaac: Repentance**. It reads the files, verifies the KAGE checksum and produces JSON and Markdown with progress. **Achievements and unlocks that depend on them are excluded from the main analysis** and moved into a separate reference. Requires Python 3.10+; analysis needs no third-party libraries, no running game and no internet access. Source `.dat` files are never modified or sent anywhere.

## Results for your files

| Data | Slot 1 | Slot 2 |
| --- | ---: | ---: |
| Checksum | OK | OK |
| Characters with recorded marks | Azazel | None |
| Completion marks | 3 / 408 | 0 / 408 |
| Completed challenges | 1 / 45 | 0 / 45 |
| Recognized collected items | 144 | 0 |
| Additional unknown collection flags | 2 | 0 |
| Bestiary entries | 231 | 0 |

Slot 1: **Azazel has recorded Hard marks for Mom’s Heart / It Lives!, Satan and Boss Rush**. Challenge **#6 Solar System** is completed. These conclusions are based on this slot's counters and completed flags, not on achievements.

Separate reference: in the secrets chunk, 77 of 637 flags are set in the first file and 0 in the second. This is **not a check of the Steam account state** and not proof that the conditions were fulfilled in the corresponding slot. The origin of the flags is unknown. No conclusions about the number of Steam achievements are drawn from these two files.

Statistics: 11 credited wins over Mom’s Heart / It Lives!, 1 win over Satan, 1 death, a best win streak of 10, 11 Eden Tokens and 273 coins in the Donation Machine. Hush is present in the bestiary: 0 kills, 1 player death caused by it.

Collection flags 43 and 61 are set, but no item in the bundled reference corresponds to them. They are kept in the JSON without an invented name. The number 146 is the sum of all set flags, **not the number of reliably recognized items**.

Ready-made results:

- [Slot 1 report](reports/rep_persistentgamedata1.md) and [full JSON](reports/rep_persistentgamedata1.json).
- [Slot 2 report](reports/rep_persistentgamedata2.md) and [full JSON](reports/rep_persistentgamedata2.json).
- [Slot 1 secrets, separate reference](reports/rep_persistentgamedata1.achievements.md) and [JSON](reports/rep_persistentgamedata1.achievements.json).
- [Slot 2 secrets, separate reference](reports/rep_persistentgamedata2.achievements.md) and [JSON](reports/rep_persistentgamedata2.achievements.json).
- [Research on the format and the extraction approach](RESEARCH.md).

## Running

From the project root:

```sh
python3 isaac_save.py context/rep_persistentgamedata1.dat context/rep_persistentgamedata2.dat --output reports
```

For a single file, JSON can be written to stdout:

```sh
python3 isaac_save.py context/rep_persistentgamedata1.dat
```

All 11 chunks, including unknown counters and internal values:

```sh
python3 isaac_save.py context/rep_persistentgamedata1.dat --raw
```

A file with an invalid checksum is normally rejected. For diagnostics you can pass `--allow-invalid-checksum`: the JSON and the report then explicitly mark the data as unverified. An invalid structure is still rejected.

## Steam, secrets and slot accomplishments

In Isaac, secrets can be synced from Steam into a new slot without restoring the corresponding character marks and challenge completed flags. This scenario is described by the author of a [tool that restores marks from Steam](https://github.com/agusaenz/isaac-save-auto-editor-steam#first-steps). The tool itself was not run. Steam stores achievements per user and application: [Steamworks GetPlayerAchievements](https://partner.steamgames.com/doc/webapi/ISteamUserStats?l=english#GetPlayerAchievements) has no concept of a game slot.

Therefore an unlocked achievement does not credit a boss, a challenge, a collection item, playing as a character or an achievement condition in this slot. This rule always applies, regardless of the presumed origin of the flag. We do not determine whether a sync actually happened in your case.

**Verified scenario:** on an in-memory copy of an empty slot, all 637 secrets were set and the checksum was recalculated. The main analysis remained equivalent, value for value in the JSON, to the analysis of the original empty slot: 0 marks, 0 challenges, 0 collection items, an empty bestiary. The source `.dat` files were not modified.

## What the JSON contains (schema_version = 2)

- `raw`: all chunks, source arrays, offsets, sizes, SHA-256, and the stored and computed checksums.
- `progress`: **the only source for further conclusions about accomplishments in the slot**. Its result does not change when any values of the achievements chunk change.
- `progress.characters`: 34 characters × 12 goals; values `not_completed`, `normal`, `hard`, `greed`, `greedier`. Character availability via secrets is not used. `roster_index` is an index in the analyzer's list, **not the game's PlayerType**.
- `progress.items`: only collectibles with the `collected` flag from the collection. There are no item unlock states or achievements here.
- `progress.bosses`: individual killed-boss flags by BossType.
- `progress.challenges`: 45 challenges, completed and not completed, with rewards.
- `progress.bestiary`: Type/Variant, the full packed key, kills, encounters, hits taken from the enemy and player deaths.
- `progress.event_counters`: all 496 counters, including zero and undecoded ones.
- `achievement_reference`: a separate reference, `excluded_from_gameplay_analysis=true`. In it, `achievements` are the save's secret flags and `content_unlocks` is character/item availability based on those flags. The field `earned_in_this_slot=null`: where the condition was fulfilled is not established.
- `achievement_reference.steam_account`: `status=not_queried`, `achievements=null`. Steam was not queried; an unknown state is not presented as zero achievements.
- `catalog_sources`: URLs and SHA-256 of the reference sources.

In schema version 2, achievements and character/item availability were removed from `progress` and its summary. The full JSON keeps them only in a separate branch; the `*.achievements.json` / `*.achievements.md` files contain the reference separately. `raw.chunks.achievements` remains for checking the source bytes, not for accomplishment analysis. The rule for further work is set out in [AGENTS.md](AGENTS.md).

**Unlocked ≠ collected ≠ condition fulfilled here.** An item missing from the collection does not mean it is locked. For trinkets and cards, these files do not provide a similar "picked up at least once" list.

Names, conditions and item-to-achievement mappings come from a community reference. This is an interpretation of the data, not an export of your installed version's resources. Some items are available from the start; an associated achievement does not by itself imply a mandatory unlock threshold. Item availability also does not guarantee that it will drop: room, pool and run restrictions still apply.

## Refining items using your game's resources

For a more precise match with a specific version, you can provide unpacked `items.xml` files. Order them base resources first, then DLC; a later file overrides an earlier one:

```sh
python3 isaac_save.py context/rep_persistentgamedata1.dat --output reports \
  --items-xml /path/to/resources/items.xml \
  --items-xml /path/to/resources-dlc3/items.xml
```

The analyzer uses `id`, the type and `achievement` from the XML. If `achievement` is missing or equals 0, the item is considered not to require an achievement. **All unlock conclusions belong only to `achievement_reference` and do not take part in accomplishment analysis.** Internal localization names of the form `#...` do not replace an already known readable name. The XML refines collectibles and trinkets; conditions not expressed as an achievement, cards and pills require a separate reference. A partial XML overrides only the entries it contains.

## Version support

Specifically Repentance has been verified: **638 achievement cells, 496 counters, 733 collection cells**. Achievement cell 0 is unused: there are 637 real achievements.

Afterbirth+, Repentance and Repentance+ use the same header string, so the header alone is not enough to determine the version. For a different set of achievements/counters, the named analysis stops with a clear error. `--raw` has additionally been verified on Repentance+ (642/523) and Rebirth (9 chunks, 179/95, a different checksum). The named Python analysis is still limited to Repentance; website support for newer editions is described above. Afterbirth has not been verified.

## Tests

```sh
python3 -m unittest discover -s tests -v
```

24 tests: both original checksums, chunk offsets, Azazel's marks, the empty slot, Hush, the unlocked/collected distinction, corruption and truncation, unknown entities, different versions, XML, preservation of input files, independence of progress from secrets and separation of report files. Among other things, an empty slot with all 637 secrets unlocked is tested. The tests for the two saves depend on the research samples provided in `context/`.

## Updating the reference

```sh
python3 tools/build_catalog.py
```

Only this separate operation accesses the internet. It reads pinned REPENTOGON sources and a Deadgod Tracker data snapshot, verifies the snapshot hash and writes `data/catalog.json`. The downloaded JavaScript is not executed: only data literals are read. If the remote snapshot changes or disappears, the link and the pinned hash must be updated deliberately. Attribution: [THIRD_PARTY.md](THIRD_PARTY.md).
