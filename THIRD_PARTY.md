# Источники и атрибуция

Парсер `isaac_save.py` написан для этого проекта. Код сторонних редакторов не исполняется и не используется как runtime-зависимость. Он реализует описанный формат и сохраняет все исходные числовые данные.

## REPENTOGON

[TeamREPENTOGON/REPENTOGON](https://github.com/TeamREPENTOGON/REPENTOGON), снимок `9833f482100d6a62896831d2c744d1efe710d7f1`.

Использованы описание формата и фактические соответствия enum ID → название из `EventCounter.md` и `BossType.md`. Исходный проект распространяется по GPL-2.0. Его C++-код не включён в этот проект. Ссылки и хеши файлов справочника сохранены в `data/catalog.json`.

## Deadgod Tracker

[Deadgod Tracker](https://deadgod.yeeterie.org/), публичный модуль `/assets/data-d8ce3ab0.js`. Встроенная страница атрибуции приложения указывает: “Deadgod Tracker is released under the MIT License. © 2026 Douwdy.”

В `data/catalog.json` сохранена выборка справочных данных: имена, игровые ID, соответствия достижениям, условия открытия, персонажи, награды испытаний и имена сущностей. Изображения, шрифты, эффекты предметов и исполняемый код приложения не включены. Снимок закреплён SHA-256 в `tools/build_catalog.py`; хеш также записан в каталоге.

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

## Сверка контрольной суммы

[jamesthejellyfish/isaac-save-edit-script](https://github.com/jamesthejellyfish/isaac-save-edit-script), снимок `516fe1c8d3245677313c159bd1debde37f80fbd0`: использован для исследования алгоритма KAGE и сверки результатов. Таблица checksum не копируется; парсер генерирует её самостоятельно.

Игра, её названия и игровые данные принадлежат соответствующим правообладателям. Проект — независимый инструмент чтения сохранений.

## Каталог фронтенда и игровые спрайты

Категории и порядок анлоков основаны на [Most & Least Important Unlocks, jnub](https://steamcommunity.com/sharedfiles/filedetails/?id=2994836310). В `site/data/unlocks.json` приведены факты, краткие условия и ссылки на источники; полный текст руководства не воспроизводится. Подробности: `docs/guide-sources.md`.

164 локальных PNG подготовлены из публичных ресурсов Isaac Save Editor и Deadgod Tracker. Manifest содержит исходные URL и SHA-256; права на игровую графику остаются у правообладателей игры. Лицензия MIT приложения не объявляется лицензией на игровые спрайты. Подробности: `docs/asset-sources.md`.
