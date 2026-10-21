# Progression map

The **Phases** tab (`#/phases`) presents ten main phases from Mom to Dead God, plus the parallel Greed, Greedier, Lost's Holy Mantle and Keeper milestones. Main phases always remain in chronological roadmap order, including completed phases and unresolved earlier gaps. On small screens the side path follows the main lane.

`site/js/progression.js` defines stable phase IDs, themes, artwork references and independent goals. `progressionForSave` creates a strict evaluator without collection-based unlock inference or availability flags. Rebirth uses the existing compatibility screen; the roadmap targets Repentance and Repentance+.

The current focus follows the furthest directly demonstrated entry or completed exit, without completing earlier conditions automatically. Repeated wins require credited counters. A single boss win can be demonstrated by its credited counter or a character mark. Greedier coverage requires the harder Greed cell. Tainted character marks can demonstrate advanced character progress without proving a Beast victory.

Cards are illustrated journal pages with a route rail and a compact ten-milestone navigator. Completed phases have a check medal, a green rail marker and a completion stamp. The current phase has a purple border and an explicit location label. Future phases without demonstrated entry access use grayscale, fogged artwork, a lock and an entry hint. Hush becomes visually available at ten Heart wins independently of the photograph phase. The late completionist chapters follow roadmap prerequisites rather than claiming that the game prevents pursuing those tasks earlier.

A newly observed completion plays a short stamp/medal animation and a transient announcement. A per-loaded-save status snapshot prevents repeated celebration on language changes or ordinary navigation; replacing the save clears that snapshot. Reduced-motion preferences remove the moving effects and use a static timed announcement.

Automatic completion and manual confirmation are visibly distinct. The Mom milestone and historical Greed donation milestones allow manual confirmation when automatic evidence is unknown. Other unrecorded conditions can be reviewed and individually confirmed in the existing unlock graph. Phase confirmations do not alter save bytes, statistics, secret flags or the tier list.

Phase-specific confirmations are stored in the existing `skill-issue-save` browser entry, alongside its current save snapshot, and restored with that snapshot. An explicit reload of the same source preserves them. Choosing another save or continuing with a new empty slot clears them, even if the new file has the same name. Forgetting the save removes the snapshot. Only the allowlisted confirmation keys are restored; unknown or non-boolean values are ignored. Ordinary unlock-graph confirmations retain their existing tab-only lifetime.

## Phase tier lists

`site/data/phase-recommendations.json` contains curated unlock priorities for all ten phases and four side milestones. Each placement references a shared catalog node by ID and supplies its own `rank` and `order`, for example `{nodeId: "collectible:114", rank: "S", order: 0}`. These editorial priorities are independent of the global tier list. The same item can appear in several phases without duplicating its artwork or unlock conditions. The profile is checked by the data validator.

Each card includes collapsible tier rows with local sprites, names, status markers and links to the existing unlock graph. Available phases expand by default; locked phases start collapsed. A page-level filter hides obtained recommendations. Disclosure choices and the filter survive rerenders, navigation and language changes during the current session.

A check indicates an independently verified unlock condition, including explicitly confirmed facts; a diamond indicates collection evidence. A pickup can mark a recommendation obtained but never proves the original unlock condition or changes phase completion. Secret flags do not affect these states. Recommendation counts and phase milestones remain independent.

The Dead God chapter shows a rotating shortlist of up to twelve missing collectibles from the authoritative required collection profile. Curated priorities come first; other missing collectibles fill the remaining places in ID order. Picked-up items leave the shortlist even when their unlock history is unknown. Its counter describes the full required collection, not just the visible twelve. Cards, runes and trinkets are excluded from this collection shortlist.

The CSS lane layout uses ordinary document flow: adding tier rows inside one phase can increase its height without recalculating absolute graph positions. Keep the side lane independent and preserve the first-to-last vertical ordering.

Research and route caveats: [progression phases research](progression-phases-research.md). Behavioral coverage is in `tests/progression.test.mjs` and `tests/phase-recommendations.test.mjs`; actual navigation, translations and snapshot restoration are exercised in `tests/upload-flow.test.mjs`.
