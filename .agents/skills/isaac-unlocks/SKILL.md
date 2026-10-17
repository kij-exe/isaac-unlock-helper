---
name: isaac-unlocks
description: Add or correct Isaac unlock items, characters, routes and their prerequisites in this repository's declarative catalog, including tier placement, local sprites and graph validation. Use for extending Skill Issue Tracker, not for unlocking or editing a player's game save.
---

# Extend Skill Issue Tracker

Work in the user's `isaac-unlock-helper` checkout. Read its `AGENTS.md` and `docs/unlock-schema.md` before changing unlock data. Runtime data lives in `site/data/unlocks.json`; UI and graph engine consume it without per-item code changes.

For the requested unlock, verify the actual game ID, type, wiki URL, condition and dependencies against game resources, IsaacDocs or a reputable community wiki. Preserve the source guide's category and order for existing entries. For an additional item, use an appropriate existing tier unless the user requests a new category. Paraphrase facts; keep source URLs on each new node.

Use stable IDs (`collectible:114`, `character:isaac`, `feature:sheol`); reuse existing dependency nodes. Express conditions through the documented `all`, `any`, `node`, `mark`, `counter`, `challenge`, `character_played`, `boss_defeated`, `collected`, `manual` and `constant` forms. Model alternative access routes as OR, and simultaneous requirements as AND. Separate a collectible from a character's starting upgrade.

Never use a secret/Steam achievement as proof that its condition was completed in this slot. `secretId` is only availability-reference metadata. Direct `unlock.evidence` must use recorded slot facts or explicit manual confirmation, never node references or achievement flags. If a run-local action or historical detail cannot be recovered from the save, use `manual` with a stable key, exact action label and reason. Do not substitute a similar lifetime/current counter for an unrecorded per-run condition.

Add only missing prerequisites and keep the graph acyclic. A satisfied prerequisite must disappear with its ancestry; a closed shared prerequisite must remain one shared node. Usually a new item needs only JSON and a local sprite, not an engine change.

Write every text field (`name`, `label`, `description`, `reason`, `sourceNote`) in English and add its Russian translation to `site/js/locales/ru-catalog.js`; `tests/i18n.test.mjs` fails if a description, manual reason or note has none. See `docs/i18n.md`.

Run `python3 tools/fetch_icons.py` for missing images; inspect its manifest failures rather than claiming an unrelated image is correct. Every catalog node must have a local image under `site/assets/icons/`. The packager uses verified game sprites and unlock-notification artwork for known mechanics, and explicitly `designed` original SVG illustrations for challenges or routes without a verified sprite. Both statuses are supported by the UI and validator. Keep illustration provenance explicit; never pass unrelated item art off as a mechanic's sprite. If the environment lacks the downloader's Pillow dependency, preserve the data change and report the asset gap or use a verified PNG source directly with manifest attribution.

Validate using `npm run validate:data`, `npm test` and `npm run build`. For a new condition kind, add a meaningful behavioral test and update the schema; do not encode arbitrary code in JSON. Dead God is a generated goal above S–F: use `tools/build-dead-god.mjs` and the pinned `site/data/dead-god-collection.json` profile when changing its four aggregate nodes. Its 636 goalSecretId labels are checklist metadata, never secret evidence. Required collection excludes hidden effects; do not replace the list with every byte or every generic catalog item. Preserve the test proving that all 637 secret flags on an otherwise empty save create no gameplay progress or progress-based graph changes.

Do not modify original `.dat` files, publish, or alter unrelated configuration as part of adding data. Follow the user's Git restriction: only `git status` and `git diff` may run; do not invoke Git through wrappers.
