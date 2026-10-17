# Sources and scope of the unlock catalog

The catalog `site/data/unlocks.json` was compiled on 14 October 2026 from [Most & Least Important Unlocks (Repentance+) — jnub](https://steamcommunity.com/sharedfiles/filedetails/?id=2994836310). The page describes **unlock priority**, not the universal strength of items: difficulty of obtaining also affects placement. The author's original categories are preserved in the JSON. At the user's request, the interface groups them into S–F: this is a separate editorial grouping of priorities, not the author's letter grades.

The website supports the parsed save structure of **Repentance: ISAACNGSAVE09R, 638 secret flags and 496 counters**. The ranking on the page has already been updated for Repentance+. Extended Repentance+ saves are not declared compatible. Item balance differs between versions; wiki links open the current reference.

## Coverage

The catalog has 233 nodes, of which 188 are included in the guide's categories. 130 nodes have an exact match in the game's item/trinket/card catalog; the rest are characters, starting upgrades, floors, challenges, pills and game mechanics. All 34 characters are represented: the author's line "all other characters" is expanded into separate nodes. 45 nodes without a place in the tier list were added for explanations and dependencies.

| Author's section | Nodes in category |
| --- | ---: |
| Runes | 9 |
| The Good Ones (Part 1) | 28 |
| The Good Ones (Part 2) | 21 |
| The Good Ones (Part 3) | 22 |
| The Good Ones (Part 4) | 16 |
| Before the Bad Ones (Part 1) | 44 |
| Before the Bad Ones (Part 2) | 12 |
| The Bad Ones (Part 1) | 19 |
| The Bad Ones (Part 2) | 11 |
| The Bad Ones (Part 3) | 6 |

Within sections, the order of standalone recommendations is preserved. Joint rewards are split: for example, Blank Rune / Clear Rune, The Sun? / The Moon?, Strange Door / Jacob & Esau. The optional upgrades Keeper’s Penny and Inner Child stay in their section. Confessional, discussed next to Magic Skin, is shown separately. Items mentioned only for context (for example, Death Certificate, Mega Mush, D4, Holy Mantle) are added without a rank of their own.

The author kept the old entries for **Berkano, Hushy, D100 and Plan C**, but in the addenda withdrew the recommendation to avoid them. The catalog keeps the original section and explicitly reports the change in `sourceNote`. D100 in particular is needed to obtain Godhead. Priorities are the author's opinion, not an objective prohibition on obtaining an item.

## Interface letter tiers

`site/js/tier-ranks.js` defines six visual rows: S — unlock first, A — high priority, B — useful addition, C — after the main unlocks, D — low priority, F — can be postponed. Base mapping of sections: good-1 → S; good-2/3 → A; good-4 and before-1 → B; before-2 → C; avoid-1 → D; avoid-2/3 → F.

Runes are distributed separately. The D6, Birthright, C Section, Twisted Pair, Glitched Crown and Spindown Dice are raised to S; Rock Bottom, Keeper’s Sack, Revelation, Stop Watch and Echo Chamber to A. For Berkano, Hushy, D100 and Plan C, the author's withdrawn "postpone" recommendations are taken into account: they are moved to B/C. This is a subjective editorial assessment of unlock priority; conditions and dependencies are not affected by it. A node can override its visual placement with the `rank` field.

## How conditions were verified

Numeric Item IDs, Save Secret IDs and base conditions were matched against the existing `data/catalog.json`. Its provenance is in the `sources` of that file: [REPENTOGON EventCounter](https://github.com/TeamREPENTOGON/REPENTOGON/blob/main/docs/docs/enums/EventCounter.md), BossType and the [Dead God](https://deadgod.yeeterie.org/) catalog. Every node has its own `sources` and a `wikiUrl` link.

Refinements of complex dependencies were checked against available indexed material from the [Isaac Wiki](https://bindingofisaacrebirth.wiki.gg/):

- [The Tank](https://bindingofisaacrebirth.wiki.gg/wiki/The_Tank): access is determined by unlocking Magdalene; additional Heart victories are not needed.
- [Solar System](https://bindingofisaacrebirth.wiki.gg/wiki/Solar_System): three victories over Mom’s Heart.
- [Darkness Falls](https://bindingofisaacrebirth.wiki.gg/wiki/Darkness_Falls): in Repentance it requires 11 Heart victories and a victory over ??? as Eve, tied to Sacrificial Dagger.
- [Cat Got Your Tongue](https://bindingofisaacrebirth.wiki.gg/wiki/Cat_Got_Your_Tongue): requires the Guppy transformation; collecting three Guppy items across different runs does not count as this action.
- [The Family Man](https://bindingofisaacrebirth.wiki.gg/wiki/The_Family_Man): 11 Heart victories and both Key Pieces in one run.
- [Glass Cannon (Challenge)](https://bindingofisaacrebirth.wiki.gg/wiki/Glass_Cannon_(Challenge)): requires Family Man, Lokii, Judas and It Lives!.
- [The Guardian](https://bindingofisaacrebirth.wiki.gg/wiki/The_Guardian): access opens after Mom; completion unlocks Blank Rune and Clear Rune.
- [Isaac’s Awakening](https://bindingofisaacrebirth.wiki.gg/wiki/Isaac%27s_Awakening): unlocked by defeating Mother.
- [The Forgotten](https://bindingofisaacrebirth.wiki.gg/wiki/Forgotten): requires a prior victory over The Lamb; the usual Broken Shovel → Boss Rush → grave chain is supplemented with an alternative via Spindown Dice. The Negative is useful but not mandatory: the Dark Room is reachable through the Sacrifice Room.
- [Holy Mantle](https://bindingofisaacrebirth.wiki.gg/wiki/Holy_Mantle): 879 donated coins grant **The Lost's starting shield**, not the item itself. Collectible 313 is available from the start.
- [Godhead](https://bindingofisaacrebirth.wiki.gg/wiki/Godhead) and [Completion Marks](https://bindingofisaacrebirth.wiki.gg/wiki/Completion_Marks): in Repentance all 12 of The Lost's marks on Hard, including Greedier, are required; the old values 6/9/10 do not apply to this version.
- [Isaac (Boss)](https://bindingofisaacrebirth.wiki.gg/wiki/Isaac_(Boss)), [Satan](https://bindingofisaacrebirth.wiki.gg/wiki/Satan) and [Delirium](https://bindingofisaacrebirth.wiki.gg/wiki/Delirium): rewards for a specific character are checked by that character's mark, not by a general secret flag.

Direct reading of some wiki.gg pages was restricted by the server (403); for the refinements listed, the indexed content of the same pages was used. The catalog does not claim that all current conditions were re-verified against an installed copy of the game. Ambiguous or unsaved actions are left as manual conditions rather than guessed from secrets.

## Proof of merit and the unlock plan

`unlock.requirements` is a recursive **all / any** expression combining references to other nodes and specific actions. It is used to build the route. `unlock.evidence` is independent proof from the slot's game progress: a mark, a challenge completed flag, a verified counter, the fact of having played the character, or a boss victory. `evidence` contains no node references, so as not to create indirect confirmation through availability and not to depend on cycles.

For example, Mom’s Knife requires Isaac, access to Sheol and a victory over Satan as Isaac. But an already recorded Isaac/Satan mark proves the action was completed by itself, even if the file does not allow reconstructing how the player opened early passage to Sheol. This is expressed by a separate `evidence`.

For complex conditions the structure is preserved, not just a single text string:

- Soul of Eden: **Boss Rush AND Hush** as Tainted Eden; different runs are allowed.
- RC Remote: **Isaac AND ??? AND Satan AND The Lamb** as Tainted Jacob.
- The Left Hand: **??? as Judas OR Ultra Pride with any character**.
- Bethany: Heart on Hard as Lazarus **AND** an unused Lazarus life. A Lazarus/Heart mark alone is not enough; Bethany's own marks prove she has already been played.
- Marbles: access to Gulp! **AND** five uses in a single run; the general counter of pills eaten is unsuitable here.
- Godhead: all 12 marks at the highest difficulty; a single general mark or secret does not replace this expression.

Access to the Cathedral and Sheol is modeled with **OR**: the regular path after It Lives! or an early Angel/Devil Room. For the Dark Room the Sacrifice Room is allowed, so that The Negative is not wrongly made mandatory. Floor nodes mean access to the route, not a victory over its boss.

## What cannot be considered confirmed automatically

A secret flag (`secretId`) is only a key for a separate availability reference. Its presence is **never used to credit a condition**, to clear the progress graph, or to draw conclusions about merit. In the explicitly selected separate "Content availability" mode, a secret may hide an already available dependency, without crediting its condition to this slot. It may have been synced from Steam; the source cannot be determined from a single file. A Save Secret ID is not declared a Steam API ID.

Some actions cannot be reconstructed unambiguously: three Devil Deals in one run, seven red heart containers at once, 55 coins at once, no damage taken/no hearts picked up on two floors, the Guppy transformation, three astrology items together, 50 items in one run, a spent Lazarus life, using Gulp! five times in a run, completing Victory Laps. For these there are stable `manual.key` values, an action label and the reason for the limitation. Absence of evidence **does not mean** the item is definitely locked.

A character's own mark is proof that the character has been played on this slot, even if its original unlock condition is unknown. It is not filtered by secrets.

The `MOM_KILLS` counter (ID 1) means credited victories over **Mom’s Heart / It Lives!**, not Mom. It is used for the 3/10/11 thresholds. The first victory over Mom cannot be read directly as `counter(1) >= 1`; a subsequent Heart clear is only sufficient indirect evidence of access to the Womb.

Current Donation Machine and Daily Streak values may decrease or reset. Reaching a threshold now proves a sufficient action, while a value below the threshold does not reconstruct the full past history. An unlock may exist while its merit remains unknown. The item collection is stored separately and means the item was picked up, not how it was unlocked; no such collection analogue is promised for trinkets, cards, pills and mechanics.

## Integrity check

Checked: uniqueness of IDs, existence of all `node` references, absence of cycles in dependencies and absence of node references in `evidence`. The catalog contains no dynamic reading of an achievement as a game condition. A new unlock is added declaratively, through the same set of expressions, without changing the save parser.
