# Sources and attribution

The `isaac_save.py` parser was written for this project. Code from third-party editors is not executed and is not used as a runtime dependency. The parser implements the documented format and preserves all original numeric data.

## REPENTOGON

[TeamREPENTOGON/REPENTOGON](https://github.com/TeamREPENTOGON/REPENTOGON), snapshot `9833f482100d6a62896831d2c744d1efe710d7f1`.

The format description and the actual enum ID → name mappings from `EventCounter.md` and `BossType.md` were used. The original project is distributed under GPL-2.0. Its C++ code is not included in this project. Links and hashes of the reference files are stored in `data/catalog.json`.

## Deadgod Tracker

[Deadgod Tracker](https://deadgod.yeeterie.org/), public module `/assets/data-d8ce3ab0.js`. The application's built-in attribution page states: “Deadgod Tracker is released under the MIT License. © 2026 Douwdy.”

`data/catalog.json` contains a selection of reference data: names, game IDs, achievement mappings, unlock conditions, characters, challenge rewards and entity names. Images, fonts, item effects and the application's executable code are not included. The snapshot is pinned by SHA-256 in `tools/build_catalog.py`; the hash is also recorded in the catalog.

MIT License — © 2026 Douwdy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## Checksum cross-check

[jamesthejellyfish/isaac-save-edit-script](https://github.com/jamesthejellyfish/isaac-save-edit-script), snapshot `516fe1c8d3245677313c159bd1debde37f80fbd0`: used to research the KAGE algorithm and to cross-check results. The checksum table is not copied; the parser generates it itself.

The game, its names and its game data belong to their respective rights holders. This project is an independent save-reading tool.

## Frontend catalog and game sprites

The unlock categories and order are based on [Most & Least Important Unlocks, jnub](https://steamcommunity.com/sharedfiles/filedetails/?id=2994836310). `site/data/unlocks.json` contains facts, short conditions and links to sources; the full text of the guide is not reproduced. Details: `docs/guide-sources.md`.

164 local PNGs were prepared from public resources of Isaac Save Editor and Deadgod Tracker. The manifest contains the source URLs and SHA-256; rights to the game graphics remain with the game's rights holders. The application's MIT license is not declared to be a license for the game sprites. Details: `docs/asset-sources.md`.
