# Extracting the most information from an Isaac save

Research date: 2026-10-23. This is a source and fixture audit, not an implementation of new website features. Original saves were read without modification. Private fixture details and decoded data are in `reports/save-data-audit-2026-10-23.json`, outside the public website.

## One-file workflow

**One supported `persistentgamedata` file is sufficient for persistent progress and content availability, including whether the Planetarium is unlocked.** The site's versioned lookup catalogs can supply the names and mappings; users do not need to upload XML, logs, settings, control bindings or a gamestate for this task. Installation resources are useful when building or checking those catalogs, not a mandatory companion to each save upload. A gamestate is relevant when the question concerns the current run's inventory or generated rooms. This distinction corrects an overly broad earlier recommendation to provide a full set of files.

## Implemented availability follow-up

The website now applies a pinned mapping for every catalog item and character from a single persistentgamedata file. All ten missing gate mappings listed in the original audit below were corrected. Seven false default entries now use actual conditions; Steven, Glass Cannon, Pay To Play and Little Horn no longer inherit unrelated gates. A Pony and White Pony keep their reviewed boss-drop gates. Challenge access now evaluates available prerequisites independently of completion.

The sidebar clearly shows known availability without requesting manual confirmation of the original action. Statistics include locked and unlocked flags in a separate reference. The pinned source profile and compiler are documented in [unlock-schema.md](unlock-schema.md). The audit tables below describe the pre-implementation findings.

## Findings

The persistent parser already consumes the entire supported file and retains all 11 chunks in Repentance/Repentance+, or all 9 in Rebirth. There is no unexplored trailing payload in these samples. The largest immediate gaps are semantic mappings, information omitted from the interface/export, and the separate current-run format.

The game does not reconstruct every aspect of play from one persistent file. It combines persistent flags and counters with resources, executable rules, a separate resumable-run file and, when applicable, mod data. A saved state is also not a complete event history: retaining a result does not require retaining how that result happened.

Keep these outputs separate:

| Output | Meaning | Source |
| --- | --- | --- |
| `progress` | Recorded accomplishments and statistics of the slot | Marks, counters, completed challenges, collection and bestiary |
| `achievement_reference` / content availability | Content unlocked in the file | Secret flags plus verified content mappings |
| `run_state` | Snapshot of the resumable run | A matching `gamestate` or a versioned engine export |
| `raw` | Uninterpreted values for auditing | Every decoded chunk, offset and numeric ID |

Secret flags must continue to be excluded from progress. They cannot establish the historical origin of an unlock or the Steam account's state. A run snapshot must not silently change the existing persistent-progress statistics either.

## Planetarium: three different questions

| Question | Can we answer it? | Evidence |
| --- | --- | --- |
| Is the Planetarium unlocked in this slot? | Yes, for the supported Repentance profiles | Secret flag 406 |
| Were three different `stars` items collected in one historical run in this slot? | Not from that flag or the lifetime collection | Requires independent run evidence or explicit confirmation |
| Does the current floor contain a Planetarium? | Not from `persistentgamedata` alone | Current floor's room descriptors; Planetarium room type is 24 |
| What is its generation chance? | Requires run context and the correct game rules | Stage, mode, room visits, relevant items/trinkets and possible mod callbacks |

The [REPENTOGON achievement enum](https://github.com/TeamREPENTOGON/REPENTOGON/blob/e2c5aecacbbb83bb5938cfa89c0a58b78e616a36/docs/docs/enums/Achievement.md#L534) identifies 406 as `PLANETARIUMS`. The [item XML documentation](https://wofsauge.github.io/IsaacDocs/rep/xml/items.html) documents the `stars` tag. The [room type enum](https://wofsauge.github.io/IsaacDocs/rep/enums/RoomType.html) identifies `ROOM_PLANETARIUM` as 24.

The existing `feature:planetarium` node already has `secretId: 406`. `createEvaluator().availability()` reads it, while `earned()` independently evaluates its manual condition. Therefore an unlocked Planetarium and an unknown historical condition are an expected combination. The tier list and graph default to availability. The optional **Slot progress** graph view is available inside **Data, limitations and settings**, with descriptions of both modes and their limits. An unknown historical condition in that view is not evidence that the parser missed the availability flag.

All five persistent fixtures were inspected. The Repentance+ slot 1 fixture has flag 406 set; the Repentance+ slot 2 and both Repentance fixtures do not. Rebirth has no such field. The current evaluator returns these availability states correctly.

Do not infer a room's actual presence from a percentage. The floor may already have been generated. The [Planetarium calculation implementation](https://github.com/TeamREPENTOGON/REPENTOGON/blob/e2c5aecacbbb83bb5938cfa89c0a58b78e616a36/repentogon/Patches/CustomDevilPlanetariumChance.cpp#L200) also shows why availability, mode restrictions and mod callbacks matter.

## Coverage of the persistent file

Counts below describe the verified current Repentance+ profile, not a universal layout.

| Chunk | Stored data | Current coverage | Useful next step |
| --- | --- | --- | --- |
| 1 | 642 secret slots | Parsed; separate reference and mapped availability | Complete content mappings without crediting accomplishments |
| 2 | 523 event counters | Parsed; 408 completion counters mapped; selected statistics displayed | Show all named counters with IDs and units |
| 3 | 14 level counters | Retained in raw; omitted from browser `slotProgress` and its statistics export | Display raw first; verify stage mapping and increment/reset behavior |
| 4 | 733 collection slots | Parsed; named collection and Dead God checks | Keep hidden/undefined IDs separate from collection goals |
| 5 | 7 miniboss flags | Retained in raw; omitted from browser progress/export | Verify flag indexing and event meaning before deriving goals |
| 6 | 104 boss slots | Parsed and mapped into browser progress | Expose recorded flags separately from bestiary kills and credited wins |
| 7 | 46 challenge slots | Parsed; completed flags used | Retain the distinction between challenge access and completion |
| 8 | 27 cutscene counters | Retained in raw; omitted from browser progress/export | Map cutscenes from matching resources; establish what increments them |
| 9 | 2 settings integers | Retained in raw; omitted from browser progress/export | Expose as technical metadata pending verified meanings |
| 10 | 80 special-seed flags | Retained in raw; omitted from browser progress/export | Verify indices against the matching seed menu; these are not run seeds |
| 11 | Variable bestiary maps | All four maps retained; interface mainly shows bosses | Show ordinary enemies, variants and hit counts as well |

The format and separation of the companion run are documented in [REPENTOGON SaveFile.h](https://github.com/TeamREPENTOGON/REPENTOGON/blob/e2c5aecacbbb83bb5938cfa89c0a58b78e616a36/repentogon/SaveSyncing/SaveFile.h#L10). Existing project implementations are `site/js/save-parser.js` and `isaac_save.py`.

The browser statistics page has 29 distinct non-mark counter IDs in its Repentance+ tables. Another 86 non-mark slots are absent from those tables, including reserved ID 0 and five unknown IDs. Examples of already named data we can expose immediately include daily attempts/wins, Greed donations by character, batteries collected, cards used, key-opened chests, secret-room walls, beds, Baby Plum and Battery Bum counters. This requires no new binary decoding.

These are different levels of support: `slotProgress.counters` already includes all event counters, whereas its object and JSON export omit chunks 3, 5, 8, 9 and 10. Raw bytes are retained by `parseSave`; information disappears at the presentation/export layer.

IDs 8, 19, 112 and 189 remain explicitly unknown in the event catalog, with 496 additionally unknown in Repentance+. Reserved ID 0 is not a statistic. An enum label alone also does not establish units or historical semantics. Level-counter values must not be advertised as floor clears until their increment behavior has been verified; cutscene counts must not be equated with boss wins without equivalent evidence.

The Python raw decoder handles all five persistent fixtures. Its named semantic analyzer still accepts only the Repentance 638/496 profile; the browser has broader semantic profile support. Broadening Python analysis is a separate task from discovering more bytes.

## Resource audit: ten availability mappings to review

The game resources provide facts that a binary file does not contain: names, ID relationships, item tags, visibility, pools and unlock gates. Comparing the existing catalog against the already pinned Repentance 1.7.9b.J835 resources found these positive `achievement` attributes without corresponding node `secretId` metadata:

| Node | Resource gate | Current node behavior |
| --- | ---: | --- |
| Ball of Bandages, collectible 207 | 6 | Default available |
| More Options, collectible 414 | 135 | Default available |
| Hairpin, trinket 120 | 358 | Default available |
| Wooden Cross, trinket 121 | 359 | Default available |
| Butter!, trinket 122 | 360 | Default available |
| Filigree Feather, trinket 123 | 370 | Default available |
| Extension Cord, trinket 125 | 381 | Default available |
| Telescope Lens, trinket 152 | 406 | Manual / unknown |
| Ancient Recall, card 53 | 362 | Manual / unknown |
| Cracked Key, card 78 | 415 | Manual / unknown |

Sources: pinned [items.xml](https://github.com/Derugon/TBoIR-resources/blob/44ac14726d9904d2032c202283817a35a73bcd82/1.7.9b.J835/resources-dlc3/items.xml) and [pocketitems.xml](https://github.com/Derugon/TBoIR-resources/blob/44ac14726d9904d2032c202283817a35a73bcd82/1.7.9b.J835/resources-dlc3/pocketitems.xml). Their SHA-256 digests are stored in the private audit. There were no conflicting positive gate IDs among the nodes already mapped in this comparison. The comparison covers matching collectible/trinket/card IDs, not every kind of graph node.

These are resource metadata discrepancies, not ten newly proven accomplishments. Some gates are shared with other content; a node need not have an achievement bearing its own name. Review version differences, bootstrap/booster-pack rules and runtime availability before treating every XML attribute as a universal restriction. The three manual entries have concrete mappings to investigate instead of leaving them unmapped indefinitely. Updating these nodes should follow the repository's unlock skill.

For maximum accuracy, obtain resources from the actual installation in its effective base → DLC → mod order, with version and hash provenance. The pinned Repentance XML is not proof of identical Repentance+ or modded behavior. The existing Python `--items-xml` overlay already supports item/trinket gates; an equivalent catalog build step should also process pocket items, players, challenges, item pools, cutscenes and seed-menu resources. Never turn an unmapped entry into default availability solely because its mapping is missing.

## What the two gamestate fixtures establish

The current samples have distinct headers, `ISAACNG_GSR0169` and `ISAACNG_GSR0163`, and sizes 106,335 and 55,812 bytes. The current parser intentionally rejects both as run-state files. They need a separate versioned reader.

Both can already be paired with their persistent companions by content:

| Pair | Persistent `gameStateChecksum` | KAGE of gamestate bytes `[16, length - 4)` |
| --- | --- | --- |
| Repentance+ slot 1 | `F03A5441` | `F03A5441` |
| Repentance+ slot 2 | `11E37794` | `11E37794` |

The values agree independently in JS and Python. Filename similarity alone is insufficient for future imports. These matches identify compatible snapshots in the fixture set; they do not establish full resumability or semantic validity. In particular, the final four bytes of these gamestate files differ from those values: do not reuse the persistent-file trailing-checksum assumption.

[REPENTOGON's GameState declarations](https://github.com/TeamREPENTOGON/REPENTOGON/blob/e2c5aecacbbb83bb5938cfa89c0a58b78e616a36/libzhl/functions/GameState.zhl) and [GameStatePlayer declarations](https://github.com/TeamREPENTOGON/REPENTOGON/blob/e2c5aecacbbb83bb5938cfa89c0a58b78e616a36/libzhl/functions/GameStatePlayer.zhl) identify room state, players, item/boss pools, seeds, backwards-stage records and player history. They are valuable reverse-engineering leads, but describe memory structures and function signatures, not the complete serialized byte order. Pointer, vector and structure offsets cannot be copied into a file parser.

An offline reader is feasible research work, but no complete verified gamestate decoder was established in this investigation. No character, inventory, room presence or Planetarium chance is claimed from guessed offsets in these fixtures. Supporting both observed versions, bounds/count checks and isolated comparisons with the game's restored state are necessary before trusting such fields.

## Ways to obtain more data

1. **Expand the existing persistent view first.** Export every decoded field with source chunk/index, raw value, known/unknown label and interpretation confidence. Display the full named event catalog and all bestiary entries. Keep availability and progress labels visible together so an available feature does not look unreadable because its historical condition is unknown.
2. **Rebuild and validate resource mappings.** Use the target installation's effective resources and explicit shared gates. Validate every manual condition against available independent counters, flags or bestiary evidence before deciding it cannot be checked. Do not replace single-run conditions with lifetime collection totals.
3. **Add an optional run snapshot import.** Keep the existing one-file persistent upload sufficient. Accept a companion gamestate only in a separate run view, validate its profile and relationship, and leave unsupported fields unknown. Use distinct `run_state` provenance rather than merging a current run into lifetime accomplishments.
4. **Use the engine as a reference decoder.** A small exporter can query documented APIs after game initialization and after restoring a run: persistent counters/collection/challenges/bestiary; player type, inventory and consumables; run seed/stage; room descriptors and visit counts. REPENTOGON adds APIs such as `GetPlanetariumsVisited()` and [player history](https://repentogon.com/History.html). This is a practical route to testing current-run decoding and exporting runtime facts, subject to the target build's API support.
5. **Record future events when history matters.** An optional companion mod can record the run ID, item pickups and relevant events from installation onward. It cannot reconstruct events from earlier completed runs that were never saved. Mod exports require their own schema, version, mod list and source policy.

[Level:GetRooms()](https://wofsauge.github.io/IsaacDocs/rep/Level.html#getrooms) and [RoomDescriptor](https://wofsauge.github.io/IsaacDocs/rep/RoomDescriptor.html) provide a direct runtime route to room presence and visit counts. For runtime reference checks, use an isolated test slot/copy: launching and continuing a game can itself update saves. No game was launched and no mod was installed during this audit.

## Information that must remain unknown without another source

- Exact historical sequence of runs, item combinations and circumstances that the persistent file did not retain.
- Whether an imported/unlocked secret was earned in this slot, synced, edited or carried over.
- Current inventory, generated rooms and run seed from the persistent file alone.
- Exact patch or active-mod behavior inferred only from a filename or shared persistent header.
- Full historical playtime, restart counts or total run count invented from deaths, wins or the internal load counter.
- Steam account achievements without separately reading the account and verifying ID mappings.

The game can continue a saved state while knowing none of that discarded history. A flag saying a feature is open is sufficient for generation; it does not require the old unlock event to be stored.

## Comparison with NotTwist's tracker

The [deployed tracker](https://nottwist.github.io/isaac-unlocks-tracker/) was compared with commit `ba2e20f544122ba8b1d7cd60cfaf2c64ac3bea2d`: the deployed `app.js` and `data.js` match that source byte for byte. Its primary `extractMarksFromSave()` reads completion counters; CSV data supplies reward recommendations. An exception invokes a fallback that maps secret flags to marks. It does not decode current-run state. [Import and mark-reading source](https://github.com/NotTwist/isaac-unlocks-tracker/blob/ba2e20f544122ba8b1d7cd60cfaf2c64ac3bea2d/app.js#L374-L533).

Planetarium 406 is in the local map's unused `unmatched` list, rather than a decoded Planetarium field. The map's filename does not establish a separate Steam-account query. [Mapping source](https://github.com/NotTwist/isaac-unlocks-tracker/blob/ba2e20f544122ba8b1d7cd60cfaf2c64ac3bea2d/steam-achievement-map.json#L4069-L4072).

Only the isolated parsing functions were executed locally, without browser state or network access to the private inputs. Counts below normalize Greed/Greedier to one mark position per character:

| Fixture | This project's recorded marks | NotTwist direct reader |
| --- | ---: | ---: |
| Repentance+ slot 1 | 408 | 408 |
| Repentance+ slot 2 | 0 | 0 |
| Repentance slot 1 | 3 | 3 |
| Repentance slot 2 | 0 | 0 |

Thus the comparison reveals no additional completion data missing from our supported Repentance profiles. Separate synthetic experiments found that the other reader labels an offline Normal mark `hard` and ignores online-only bits 4/8. Feeding our Rebirth fixture into its Repentance-oriented reader produces 100 positions instead of the verified 7; this is not support for that layout. These are observations about the isolated reader, not a visual browser test.

An empty valid Repentance+ slot with every secret enabled still produces zero marks in both direct readers. Explicitly invoking the other tracker's fallback on that same synthetic slot produces 372 positions. The normal import calls this fallback only if direct extraction throws, so 372 is not the result of an ordinary empty-slot import. That fallback cannot be adopted as independent slot evidence under this repository's policy.

Private reproducible results and source hashes: `reports/nottwist-tracker-comparison-2026-10-23.json`. Original saves were not modified or uploaded. No third-party implementation was copied into the website.

## Verification

- Parsed all five persistent fixtures; compared all chunk values with the independent Python decoder.
- Checked Planetarium availability and its separately unknown historical condition.
- Verified both companion checksum matches independently in JS and Python.
- Ran all 7 save-profile tests, including valid empty saves with every secret flag enabled and unchanged gameplay progress.
- Ran all 24 Python tests successfully.
- Rechecked the original SHA-256 of all seven source files after the audit.

The private audit records exact inputs, source hashes, decoded values and mapping discrepancies. No website behavior or catalog unlock rules were changed as part of this research.
