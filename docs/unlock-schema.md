# Unlock catalog and graph

`site/data/unlocks.json` is the single editable source of unlocks and their dependencies. The interface, the full graph and the graph for a selected item are all built from it. The runtime requires no Python, npm, API or application server: everything is computed in the browser.

## Data spaces

- `slotProgress(save, gameCatalog)` reads only the slot's own marks, counters, completed flags, collection and bestiary. Secret values do not affect this model.
- `evaluator.earned(id)` computes whether a condition is confirmed in the current slot. The result can be `satisfied`, `missing` or `unknown`.
- `evaluator.availability(id)` separately shows content availability based on `secretId`, without crediting the condition to this slot. Without such a flag, explicit default availability or a confirmed condition is used. An unknown state stays unknown.
- `evaluator.collected(node)` reads the standalone collection flag for active/passive items. Cards, runes, trinkets, characters and mechanics have no such stored flag: the result is `null`.

Item ID, Save Secret ID, BossType, EntityType and character index are not interchangeable. The website does not query the state of the Steam account. `secretId` is allowed only as a reference availability key and is not a condition type.

## Node

```json
{
  "id": "collectible:114",
  "kind": "collectible",
  "name": "Mom's Knife",
  "rank": "S",
  "order": 16,
  "catalog": { "kind": "passive", "itemId": 114 },
  "secretId": 43,
  "wikiUrl": "https://bindingofisaacrebirth.wiki.gg/wiki/Mom%27s_Knife",
  "unlock": {
    "description": "Defeat Satan as Isaac.",
    "requirements": {
      "type": "all",
      "conditions": [
        { "type": "node", "id": "character:isaac" },
        { "type": "node", "id": "feature:sheol" },
        { "type": "mark", "character": "Isaac", "target": "Satan", "minimum": 1 }
      ]
    },
    "evidence": { "type": "mark", "character": "Isaac", "target": "Satan", "minimum": 1 }
  },
  "sources": ["https://bindingofisaacrebirth.wiki.gg/wiki/Mom%27s_Knife"]
}
```

`rank` is absent on a helper dependency that must be shown in the graph but not as a tier-list recommendation. One ID means one object across all graphs; shared dependencies are not copied. `catalog` is needed only for game items. Supported node kinds: `collectible`, `trinket`, `card`, `rune`, `pill`, `character`, `stage`, `boss`, `challenge`, `feature`.

A character's starting upgrade is a separate `feature`, not the same collectible. For example, Holy Mantle (the item) and The Lost: Holy Mantle (the starting upgrade for 879 coins) have different conditions.

`rank` is the tier-list row: `S`, `A`, `B`, `C`, `D`, `F` or `OPEN` (available by default); `DEAD GOD` is reserved for the single full-completion goal above S–F. `order` is the position inside the row (0, 1, 2…) and is required on every entry with `rank`. Rows and their labels are defined in `site/js/tier-ranks.js`; the guide's categories (`tier`) are no longer in the data, and the validator rejects that field. `rank` does not change availability, conditions or the graph.

Rows are easiest to change on the site: drag items between rows and press “Dump tiers (JSON)”. The downloaded `unlocks.json` has the same format as `site/data/unlocks.json` and replaces it as a whole; only `rank` and `order` of the affected rows differ. Until exported, the arrangement lives only in this browser's `localStorage`, and “Reset tiers” restores the site version. The initial ranks were derived once from the guide's categories by `tools/migrate-tiers-to-ranks.mjs`.

`sourceNote` allows noting a refinement by the guide's author. `sources` contains HTTPS URLs confirming the facts; do not copy long effect descriptions or the author's assessments.

## Declarative conditions

| type | Fields | Meaning |
| --- | --- | --- |
| `all` | `conditions: Condition[]` | All conditions are required, including nested groups |
| `any` | `conditions: Condition[]` | One of the alternative paths is enough |
| `node` | `id` | Unlock another node; the reference forms a graph dependency |
| `mark` | `character`, `target`, `minimum: 1 or 2`, `label?` | Character mark: Normal/Greed or Hard/Greedier |
| `counter` | `id`, `atLeast`, `label?` | The slot's own EventCounter is at least the threshold |
| `collected` | `id: 1..732`, `label?`, `itemName?` | The actual pickup flag of the item in the slot's collection, without secrets |
| `challenge` | `id: 1..45`, `label?` | The challenge's completed flag is recorded |
| `character_played` | `character` | The character has at least one mark of their own |
| `boss_defeated` | `boss` | A positive credited-victory counter or the character's own mark for that goal |
| `manual` | `key`, `label`, `reason` | The action is not fully saved; explicit confirmation by the user is required |
| `constant` | `value: boolean` | Explicit default availability or a condition known to be unmet |

`label` explains the action in English; English is the canonical source language for all catalog text (`name`, `label`, `description`, `reason`, `sourceNote` and similar fields). Russian website translations of catalog text live in `site/js/locales/ru-catalog.js`; see [i18n.md](i18n.md) for the workflow. Complex logic is stored as structure, not as an attempt to parse text. Unknown types are not executed and are rejected by the validator. Arbitrary JavaScript and `eval` are not used.

`minimum=2` on `Greed / Greedier` means Greedier. Do not create Greed and Greedier as two independent stored flags.

Canonical goals: `Mom’s Heart / It Lives!`, `Isaac`, `Satan`, `Boss Rush`, `???`, `The Lamb`, `Mega Satan`, `Hush`, `Greed / Greedier`, `Delirium`, `Mother`, `The Beast`. Character names are taken from `site/data/game-catalog.json`.

MOM_KILLS, counter 1, is victories over Mom’s Heart / It Lives!, **not Mom**. Conditions such as "in a single run", "without dying/reviving", "enter the closet", transformations and exact victory history must not be replaced with a similar general counter. A decreasing current counter or streak does not always prove a historical record; in doubtful cases use a manual fact with an explanation.

## Direct proof of the result

`unlock.evidence` is optional independent proof of the result. If it is satisfied, the earlier steps do not need separate confirmation: a recorded Satan victory as Isaac confirms Mom’s Knife, even if the save does not allow proving how the route was originally opened.

Direct proof may be a compound `all`/`any`, but **contains no `node` and no secrets**. For Godhead it is all the required Hard/Greedier marks of The Lost, not a single victory or the final achievement. If an action is not saved, do not invent evidence. A manual fact remains an explicit user mark and is never written back to the `.dat`.

The absence of a mark for a character does not prove that the character was never played; `character_played=missing` only means there is no such confirmation. The value `unknown` is never turned into `false` or `true`.

## Two graph modes

The default is **Slot progress**: `earned` without secrets. The alternative **Content availability** mode uses `availability`, including secrets; it helps obtain content that is not yet available, but does not count it as merit in this slot. The toggle is visible above the graph.

For A and C with a shared dependency B:

```text
B not yet completed:      B completed:
       B                     A    C
      / \
     A   C
```

A completed dependency is removed together with its prerequisites; traversal does not continue to its parents. A and C remain if their own actions are not yet completed. Nodes are merged by ID, not by name.

AND/OR groups are shown as separate logical nodes when several dependencies need to be linked. Action conditions label the edges, and the full list and states are visible in the side panel. A condition without a dependency is shown in the panel of the individual node rather than getting a fictitious shared root. An already completed OR alternative excludes the remaining alternatives. For an alternative that has no nodes, a separate condition node is kept, so that an optional path is not depicted as mandatory.

`buildGraph` does not modify the catalog. `layoutGraph` performs a vertical topological layout independent of the item conditions: dependencies above rewards, wide levels wrapped into rows of four blocks. `graph-view.js` handles zooming around the cursor, dragging blocks and the background, updating edges and animated restoration. Positions apply only to the current tab and are reset when the save changes. A cyclic catalog is rejected both on load and during graph building.

## The Dead God goal

`feature:dead-god` is the only card in the top tier. The base catalog is **Repentance**, without the four additional Repentance+ secrets. After a Repentance+ save is loaded, the pure adapter `catalog-profile.js` adds four manual conditions, 638–641, and changes the condition count to 640, without modifying the original catalog. Rebirth uses its own statistics and does not apply this graph. The requirements are combined with AND: all other unlock conditions (1–636) and pickup of all 717 visible collection items. Death Certificate / 408 Hard/Greedier marks and all 45 challenge completed flags are shown separately — they are also part of the overall conditions.

`feature:dead-god-conditions` contains exactly 636 conditions tagged with `goalSecretId` in four DLC groups. This is list metadata, not an executable achievement type: 223 references reuse verified nodes, 292 conditions with an exact match to marks/counters are checked against facts, and 121 are left manual. Their original wording is preserved. An unknown or transferred secret does not turn them into completed actions. The compound historical goals Platinum God, 1001% and 1000000% are not proven by counting flags.

`feature:dead-god-collection` uses `collected` for each of the 717 IDs from `site/data/dead-god-collection.json`. Visibility is confirmed by the pinned game [items.xml Repentance 1.7.9b.J835](https://raw.githubusercontent.com/Derugon/TBoIR-resources/44ac14726d9904d2032c202283817a35a73bcd82/1.7.9b.J835/resources-dlc3/items.xml), whose SHA-256 is stored alongside. Hidden IDs 59, 656, 714, 715 and missing IDs are excluded. Broken Glass Cannon 474, quest parts and Dad’s Note 668 are included. The collection is checked directly against the save bytes, so 474 is counted even though it has no name in the old shared catalog.

`feature:dead-god-challenges` references all 45 `challenge-complete:N` nodes rather than invisible completed-flag leaves. `challenge:N` represents access to the challenge; `challenge-complete:N` requires that access and actual completion, while `unlock.evidence` checks the slot's own completed flag independently of access history. Therefore an already unlocked challenge does not disappear from the task list until it is completed. If the source of access is unknown, a completed challenge remains proven. Rewards and the overall condition list reference the same completion IDs; a reward's direct evidence remains a raw slot fact. In both graph modes, access to a challenge never substitutes for its completion.

`tools/challenge-catalog.mjs` compiles the full set of access conditions from `data/challenges-repentance.json`, pinned to the game's challenges.xml (URL and SHA-256 are inside the profile). The `requiredUnlockIds` numbers serve only as keys for resolving game rules at build time. At runtime only ordinary references to the actual item/character conditions are used; secret flags are not used for completion. The field `challenge: {id, role: "access" | "completion"}` is presentation metadata. The additional nodes do not change the original tier-list placements.

The four goal nodes are reproducibly updated offline via `node tools/build-dead-god.mjs`: it compiles only explicitly reviewed text templates into declarative conditions; the runtime does not parse text. Complex unsupported cases remain manual. Expandable groups in the panel show progress without permanently rendering thousands of rows. Their expanded state and the selected node are preserved upon manual confirmation in the current graph.

## Extending

1. Find the game ID, type, actual condition, wiki and sources; check version exceptions and starting upgrades.
2. Add the node and only the missing dependencies to `site/data/unlocks.json`, writing all text fields in English. Add Russian translations to `site/js/locales/ru-catalog.js` as described in [i18n.md](i18n.md).
3. Use existing dependency IDs. Do not duplicate B for each new item.
4. Add a local sprite via `python3 tools/fetch_icons.py`; the PNG and manifest are committed to the repository. A new class of conditions needs a separate evaluator and a behavioral test; a new item usually requires only JSON.
5. Run `npm run validate:data`, `npm test`, `npm run build`.

Ready-made skill: `.agents/skills/isaac-unlocks/SKILL.md`. It can add items without editing the interface or the graph engine.
