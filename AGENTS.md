# Isaac save analysis

- The main analysis, slot comparisons and any further conclusions about accomplishments must be based only on `progress`: completion marks, the slot's own counters, challenge completed flags, the collection and the bestiary.
- Do not use Steam achievements, chunk 1 (`achievements`) or unlocks derived from them to credit bosses, challenges, items, playing as a character, or fulfilment of conditions in a specific slot. Do not filter completion marks by character availability derived from achievements.
- Show secrets and derived unlocks separately, in `achievement_reference` / `*.achievements.*`, with a note that they are excluded from the main analysis.
- An unlocked secret does not prove that its condition was fulfilled in this slot: it may have been synced from Steam, imported or modified. The source of the flag cannot be determined from a single `.dat`.
- Do not call secret flags in a `.dat` a verified Steam account state. Without a separate read of the account, its state is unknown; do not declare a Save Secret ID to be a Steam API ID without a verified mapping.
- Verify the independence of the analysis on an empty slot with the flags of all secrets set: its gameplay progress must remain empty.
- Read source saves without modifying them. The user's global Git restriction remains in force: only `git status` and `git diff` are allowed.

## Skill Issue Tracker frontend

- The public website is `site/` only. Do not add saves, `context/` or personal `reports/` to it. `npm run build` publishes only this directory.
- To add unlocks, follow `.agents/skills/isaac-unlocks/SKILL.md`; the format and semantics are described in `docs/unlock-schema.md`.
- The unlock graph defaults to "Content availability" at the user's explicit request. It may use secrets to hide dependencies that are already available, but never for accomplishment statistics or fulfilment of conditions in the slot. Keep "Slot progress" as an optional view inside collapsed data/limitations/settings, with accurate descriptions of both modes. The active basis and its limitations must remain visible; do not put the mode selector first in the main toolbar.
- Preserve shared dependency IDs, three-valued logic for unknown conditions, AND/OR, and independent direct proof of the result. Do not add secrets as a condition type.
- Language: English is the canonical source language in code and in `site/data/unlocks.json`; the website is English by default and offers a RU/EN switch in the header. Russian translations for the website live only in `site/js/locales/ru.js` (interface) and `site/js/locales/ru-catalog.js` (catalog text). All repository docs, comments and tooling output are English-only. See `docs/i18n.md`.
- For web changes: `npm test`, `npm run validate:data`, `npm run build`. When changing the binary format, check the browser parser against Python and against the original checksums of both investigated files.
