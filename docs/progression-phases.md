# Progression map

The **Phases** tab (`#/phases`) presents ten main phases from Mom to Dead God, plus the parallel Greed, Greedier, Lost's Holy Mantle and Keeper milestones. Main phases always remain in chronological roadmap order, including completed phases and unresolved earlier gaps. On small screens the side path follows the main lane.

`site/js/progression.js` defines stable phase IDs, themes, artwork references and independent goals. `progressionForSave` creates a strict evaluator without collection-based unlock inference or availability flags. Rebirth uses the existing compatibility screen; the roadmap targets Repentance and Repentance+.

The current focus follows the furthest directly demonstrated entry or completed exit, without completing earlier conditions automatically. Repeated wins require credited counters. A single boss win can be demonstrated by its credited counter or a character mark. Greedier coverage requires the harder Greed cell. Tainted character marks can demonstrate advanced character progress without proving a Beast victory.

Cards are illustrated journal pages with a route rail and a compact ten-milestone navigator. Completed phases have a check medal, a green rail marker and a completion stamp. The current phase has a purple border and an explicit location label. Future phases without demonstrated entry access use grayscale, fogged artwork, a lock and an entry hint. Hush becomes visually available at ten Heart wins independently of the photograph phase. The late completionist chapters follow roadmap prerequisites rather than claiming that the game prevents pursuing those tasks earlier.

A newly observed completion plays a short stamp/medal animation and a transient announcement. A per-loaded-save status snapshot prevents repeated celebration on language changes or ordinary navigation; replacing the save clears that snapshot. Reduced-motion preferences remove the moving effects and use a static timed announcement.

Automatic completion and manual confirmation are visibly distinct. The Mom milestone and historical Greed donation milestones allow manual confirmation when automatic evidence is unknown. Other unrecorded conditions can be reviewed and individually confirmed in the existing unlock graph. Phase confirmations do not alter save bytes, statistics, secret flags or the tier list.

Phase-specific confirmations are stored in the existing `skill-issue-save` browser entry, alongside its current save snapshot, and restored with that snapshot. An explicit reload of the same source preserves them. Choosing another save or continuing with a new empty slot clears them, even if the new file has the same name. Forgetting the save removes the snapshot. Only the allowlisted confirmation keys are restored; unknown or non-boolean values are ignored. Ordinary unlock-graph confirmations retain their existing tab-only lifetime.

## Phase tier lists

`site/data/phase-recommendations.json` contains complete unlock priorities for all ten phases and four side milestones: every one of the 436 catalog items with an unlock condition has a placement. Each placement references a shared catalog node by ID and supplies its own `rank` and `order`, for example `{nodeId: "collectible:114", rank: "S", order: 0}`. These editorial priorities are independent of the global tier list. The same item can appear in several phases without duplicating its artwork or unlock conditions. The profile is checked by the data validator, including exhaustive unlock coverage and exact required collection membership. Explicit constant-true requirements identify default items; global ranks and secret flags never determine coverage. For example, The Gamekid is included despite its global OPEN label, while Dr. Fetus has no unlock action and only appears in the collection checklist.

Each card includes collapsible tier rows with local sprites, names, status markers and links to the existing unlock graph. Available phases expand by default; locked phases start collapsed. A page-level filter hides obtained recommendations. Disclosure choices and the filter survive rerenders, navigation and language changes during the current session.

A check indicates an independently verified unlock condition, including explicitly confirmed facts; a diamond indicates collection evidence. A pickup can mark a recommendation obtained but never proves the original unlock condition or changes phase completion. Secret flags do not affect these states. Recommendation counts and phase milestones remain independent.

Placements follow the catalog's actual route or mark condition. Early Isaac/Satan rewards belong with the photographs; Hush, regular Mother and Beast rewards belong with their route chapters. Chest, Dark Room, Boss Rush and Void rewards go with route coverage; full-mark and multi-route Tainted rewards go with character completion. Late characters' earlier-route rewards are placed in return trips rather than the first Heart/Hush cycle. Complex challenges, run-specific actions and long-term conditions are in cleanup, with useful early exceptions placed earlier. Greed and Greedier rewards have separate branches. The Lost and Keeper branches repeat the complete rewards for their characters as a convenient cross-route view. These editorial placements are suggestions, not additional access gates. Existing local priority choices are retained; newly placed items receive explicit S–F priorities in the profile. No global rank/order changes are made.

The Dead God chapter lists all 717 pickups from the authoritative required collection profile, including items available from the start. Its local ranks and positions remain stable after a pickup. Collected items stay visible with their badge until the obtained filter is enabled. The counter always describes the full required collection. Cards, runes, trinkets, hidden collectibles and missing IDs are excluded from this collection checklist. Long tier lists scroll within the illustrated card; they have no item-count cutoff.

| Chapter | Item placements |
| --- | ---: |
| Mom | 17 |
| Heart | 58 |
| Photographs | 30 |
| Hush | 13 |
| Mother | 19 |
| Beast / Home | 36 |
| Routes | 104 |
| Marks | 57 |
| Other conditions | 46 |
| Greed | 17 |
| Greedier | 36 |
| Lost | 12 |
| Keeper | 13 |
| Dead God collection | 717 |

Branch overlaps are intentional. The union of unlock chapters contains exactly 436 distinct items.

The CSS lane layout uses ordinary document flow: adding tier rows inside one phase can increase its height without recalculating absolute graph positions. Keep the side lane independent and preserve the first-to-last vertical ordering.

Research and route caveats: [progression phases research](progression-phases-research.md). Behavioral coverage is in `tests/progression.test.mjs` and `tests/phase-recommendations.test.mjs`; actual navigation, translations and snapshot restoration are exercised in `tests/upload-flow.test.mjs`.
